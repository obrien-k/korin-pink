/**
 * createBridge(config, deps) — the irc-bridge's testable core (ADR-0013).
 *
 * Mirrors korin's buildServer(config, deps?) split: all the per-user accumulation,
 * event wiring, flush, and reconnect logic lives here behind injectable deps, and
 * does NO work at import — no socket, no timer — until start() is called. index.ts
 * is the thin entrypoint that constructs the real irc-framework Client and starts it.
 *
 * The two suspected-broken v4 behaviours from #20 are pinned here:
 *   - WHO seeding: `WHO * %nuha` emits no `wholist` under irc-framework v4 (no WHOX
 *     token), so seeding goes through client.who('*') whose tokened WHOX carries the
 *     channel; the wholist handler tolerates a missing channel.
 *   - Reconnect: the real client runs with auto_reconnect:false and we own the single
 *     guarded reconnect, so a dropped socket schedules exactly one reconnect.
 */

import {
  parseVerifyCommand,
  formatVerifyReply,
  VERIFY_UNAVAILABLE,
  type VerifyOutcome,
} from './verify.js';
import { fetchStellarId } from './resolve.js';

// ---------------------------------------------------------------------------
// Injected dependencies
// ---------------------------------------------------------------------------

/**
 * The narrow subset of irc-framework's Client the bridge actually uses. Kept as an
 * interface so tests inject a fake and drive synthetic events with no live server.
 * `who` is included (beyond on/connect/raw/say/quit) because channel seeding must go
 * through the framework's tokened WHOX — see the WHO watchpoint above.
 */
export interface IrcClient {
  on(event: string, handler: (event: any) => void): unknown;
  connect(options?: unknown): void;
  who(target: string, cb?: (event: any) => void): void;
  raw(...args: string[]): void;
  say(target: string, message: string): void;
  quit(message?: string): void;
}

export interface BridgeConfig {
  host: string;
  port: number;
  tls: boolean;
  nick: string;
  saslUser: string;
  saslPass: string;
  korinApiUrl: string;
  bridgeSecret: string;
  flushIntervalMs: number;
  /** Channels the bridge JOINs on connect — it only sees activity where it's a member. */
  channels: string[];
  /** Delay before a dropped socket reconnects. Defaults to 10s. */
  reconnectDelayMs?: number;
}

export interface BridgeDeps {
  client: IrcClient;
  /** Injected so the metrics POST and stellar-id GET are assertable without a network. */
  fetchImpl?: typeof fetch;
  /** Injected clock so presence accounting is deterministic in tests. */
  now?: () => number;
  /** Injected scheduler so the reconnect count is assertable. Defaults to setTimeout. */
  scheduleReconnect?: (fn: () => void, ms: number) => void;
}

export interface BridgeHandle {
  /** Wire handlers, open the socket, and start the flush loop. */
  start(): void;
  /** Build and POST the current window's payload to korin. Returns once the POST settles. */
  flush(): Promise<void>;
  /** Seal presence, final-flush, stop the timer, and quit. */
  stop(message?: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Per-user activity accumulator for the current flush window
// ---------------------------------------------------------------------------

interface UserActivity {
  nick: string;
  stellarId?: string;
  stellarResolved: boolean; // korin gave a definitive answer (linked or not)
  joinedAt: number | null; // unix ms — null when offline
  presenceMs: number; // accumulated across joins in this window
  messageCount: number;
  channels: Set<string>;
}

export function createBridge(config: BridgeConfig, deps: BridgeDeps): BridgeHandle {
  const { client } = deps;
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const schedule =
    deps.scheduleReconnect ?? ((fn, ms) => setTimeout(fn, ms));

  const windowStart = now();
  const users = new Map<string, UserActivity>();
  // Nicks with an in-flight resolution, so concurrent sightings don't double-fetch.
  const resolving = new Set<string>();

  let flushTimer: ReturnType<typeof setInterval> | null = null;
  // Guard so v4 auto_reconnect (disabled) and a burst of `socket close` events can't
  // schedule more than one reconnect at a time — the single-source-of-truth path.
  let reconnectPending = false;

  function getOrCreate(nick: string): UserActivity {
    let u = users.get(nick);
    if (!u) {
      u = {
        nick,
        stellarResolved: false,
        joinedAt: null,
        presenceMs: 0,
        messageCount: 0,
        channels: new Set(),
      };
      users.set(nick, u);
    }
    return u;
  }

  // Resolve a nick to its Stellar id via korin and cache it on the record. A miss
  // (no linked account) still counts as resolved — stellarId stays absent and the
  // nick flushes as raw activity. An error leaves it unresolved to retry on the next
  // sighting; resolution never blocks or crashes the bridge.
  async function resolveStellarId(u: UserActivity): Promise<void> {
    if (u.stellarResolved || resolving.has(u.nick)) return;
    resolving.add(u.nick);
    try {
      const stellarId = await fetchStellarId(
        config.korinApiUrl,
        config.bridgeSecret,
        u.nick,
        doFetch,
      );
      if (stellarId) u.stellarId = stellarId;
      u.stellarResolved = true;
    } catch (err) {
      console.error(`[bridge] stellar-id resolve failed for ${u.nick}:`, err);
    } finally {
      resolving.delete(u.nick);
    }
  }

  function markOnline(nick: string, channel?: string): void {
    const u = getOrCreate(nick);
    if (u.joinedAt === null) u.joinedAt = now();
    if (channel) u.channels.add(channel);
    void resolveStellarId(u);
  }

  function markOffline(nick: string): void {
    const u = getOrCreate(nick);
    if (u.joinedAt !== null) {
      u.presenceMs += now() - u.joinedAt;
      u.joinedAt = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Flush to korin API
  // ---------------------------------------------------------------------------

  async function flush(): Promise<void> {
    const windowEnd = now();

    const payload = {
      users: [...users.values()].map((u) => {
        // Seal any still-online presence time for this window snapshot.
        const totalPresenceMs =
          u.presenceMs + (u.joinedAt !== null ? windowEnd - u.joinedAt : 0);
        return {
          nick: u.nick,
          stellarId: u.stellarId,
          presenceSeconds: Math.floor(totalPresenceMs / 1000),
          messageCount: u.messageCount,
          channelCount: u.channels.size,
          channels: [...u.channels],
          windowStart,
          windowEnd,
        };
      }),
    };

    try {
      const res = await doFetch(`${config.korinApiUrl}/irc/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-secret': config.bridgeSecret,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error(`[bridge] flush failed: ${res.status} ${await res.text()}`);
      } else {
        console.log(`[bridge] flushed ${payload.users.length} users`);
      }
    } catch (err) {
      console.error('[bridge] flush error:', err);
    }
  }

  // Relay a verify command to korin (which proxies to stellar) and whisper the
  // outcome back privately. korin owns the (nick, code) match; the bridge only
  // reports the authenticated sender nick.
  async function handleVerify(fromNick: string, code: string): Promise<void> {
    try {
      const res = await doFetch(`${config.korinApiUrl}/irc/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-secret': config.bridgeSecret,
        },
        body: JSON.stringify({ nick: fromNick, code }),
      });
      if (!res.ok) {
        client.say(fromNick, VERIFY_UNAVAILABLE);
        return;
      }
      const outcome = (await res.json()) as VerifyOutcome;
      client.say(fromNick, formatVerifyReply(fromNick, outcome));
    } catch (err) {
      console.error('[bridge] verify relay error:', err);
      client.say(fromNick, VERIFY_UNAVAILABLE);
    }
  }

  // ---------------------------------------------------------------------------
  // Reconnect — single source of truth (auto_reconnect is off on the real client)
  // ---------------------------------------------------------------------------

  function scheduleReconnect(): void {
    if (reconnectPending) return;
    reconnectPending = true;
    const delay = config.reconnectDelayMs ?? 10_000;
    console.warn(`[bridge] socket closed — reconnecting in ${delay}ms`);
    schedule(() => {
      reconnectPending = false;
      client.connect();
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Event wiring (registered only inside start, so import opens nothing)
  // ---------------------------------------------------------------------------

  function wireHandlers(): void {
    client.on('registered', () => {
      console.log(`[bridge] connected to ${config.host}:${config.port} as ${config.nick}`);
      // Seed current membership. WHO via the framework helper so the WHOX reply is
      // tokened and carries the channel (a bare `WHO * %nuha` emits no wholist in v4).
      client.who('*');
      // The bridge only sees activity in channels it's a member of — join the core set.
      for (const channel of config.channels) client.raw('JOIN', channel);
    });

    client.on('join', (event: { nick: string; channel: string }) => {
      if (event.nick === config.nick) return; // ignore self
      markOnline(event.nick, event.channel);
    });

    client.on('part', (event: { nick: string; channel: string }) => {
      if (event.nick === config.nick) return;
      const u = getOrCreate(event.nick);
      u.channels.delete(event.channel);
      if (u.channels.size === 0) markOffline(event.nick);
    });

    client.on('quit', (event: { nick: string }) => {
      markOffline(event.nick);
    });

    client.on('nick', (event: { nick: string; new_nick: string }) => {
      // Carry state over to the new nick.
      const u = users.get(event.nick);
      if (u) {
        u.nick = event.new_nick;
        users.set(event.new_nick, u);
        users.delete(event.nick);
        // The Stellar link is keyed on the nick — re-resolve under the new one.
        u.stellarId = undefined;
        u.stellarResolved = false;
        void resolveStellarId(u);
      }
    });

    client.on('privmsg', (event: { nick: string; target: string; message: string }) => {
      if (event.nick === config.nick) return;

      // ADR-0015: a private "!verify <code>" to the bot is a control-plane command,
      // not IRCScore activity. Only honoured in a private query (target is the bot),
      // never a channel — so a code is never leaked into a channel.
      if (event.target === config.nick) {
        const code = parseVerifyCommand(event.message);
        if (code) {
          void handleVerify(event.nick, code);
          return;
        }
      }

      const u = getOrCreate(event.nick);
      u.messageCount++;
      if (event.target.startsWith('#')) u.channels.add(event.target);
      void resolveStellarId(u);
    });

    client.on('wholist', (event: { users: Array<{ nick: string; channel?: string }> }) => {
      for (const entry of event.users) {
        if (entry.nick === config.nick) continue;
        // Only seed a REAL channel. A global WHO uses "*" as a placeholder channel
        // for users with no shared-channel context, and a thin reply may omit it
        // entirely — in both cases just mark the nick online and seed no channel
        // (the WHO seeding watchpoint: never assume a usable channel field).
        const channel =
          entry.channel && entry.channel.startsWith('#') ? entry.channel : undefined;
        markOnline(entry.nick, channel);
      }
    });

    client.on('socket close', () => {
      scheduleReconnect();
    });

    client.on('error', (err: unknown) => {
      console.error('[bridge] irc error:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  function start(): void {
    wireHandlers();
    client.connect({
      host: config.host,
      port: config.port,
      tls: config.tls,
      nick: config.nick,
      username: config.nick,
      gecos: 'Stellar IRC Bridge',
      ...(config.saslUser && config.saslPass
        ? { account: { account: config.saslUser, password: config.saslPass } }
        : {}),
    });
    flushTimer = setInterval(() => void flush(), config.flushIntervalMs);
  }

  async function stop(message = 'bridge shutting down'): Promise<void> {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    // Mark all online users offline before the final flush so presence is sealed.
    for (const u of users.values()) markOffline(u.nick);
    await flush();
    client.quit(message);
  }

  return { start, flush, stop };
}
