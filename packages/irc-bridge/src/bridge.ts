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
import { extractMentions } from './mentions.js';

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
  /** Post a line to a joined channel (ADR-006). Never throws; the reason is the caller's to map. */
  deliver(channel: string, message: string): DeliverOutcome;
}

/**
 * Why a line was not delivered. `not-joined` is permanent (a config error);
 * `not-connected` is transient (the socket is down or mid-reconnect).
 */
export type DeliverOutcome =
  | { ok: true }
  | { ok: false; reason: 'not-joined' | 'not-connected' };

// ---------------------------------------------------------------------------
// Per-user activity accumulator for the current flush window
// ---------------------------------------------------------------------------

interface UserActivity {
  nick: string;
  stellarId?: string;
  stellarResolved: boolean; // korin gave a definitive answer (linked or not)
  joinedAt: number | null; // unix ms — null when offline
  presenceMs: number; // accumulated across joins in this window
  messageCount: number; // total, including private queries the bridge sees
  channels: Set<string>;
  // Per-channel message tally (issue #42). Keyed by channel; only channel-targeted
  // messages land here, so its values sum to ≤ messageCount (private msgs excluded).
  channelMessages: Map<string, number>;
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
  // Directional pairwise mention tally (issue #42): from → to → count, cumulative
  // across the window like the per-user counters. stellar-api folds these into its
  // mutual-mention vector; the bridge only emits the raw directional signal.
  const mentions = new Map<string, Map<string, number>>();

  let flushTimer: ReturnType<typeof setInterval> | null = null;
  // Guard so v4 auto_reconnect (disabled) and a burst of `socket close` events can't
  // schedule more than one reconnect at a time — the single-source-of-truth path.
  let reconnectPending = false;
  // Whether the bridge is actually ON IRC, as opposed to merely running. The
  // delivery endpoint (ADR-006) answers 503 while this is false rather than
  // dropping a line into a dead socket — "process up" is not "able to speak".
  let registered = false;

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
        channelMessages: new Map(),
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

  // Tally each tracked nick `from` mentioned in this message. Only nicks already in
  // the roster can be a target, so a build a lowercase index of it per message —
  // cheap for a small community, and it always reflects the current set after joins
  // and nick changes (issue #42).
  function recordMentions(from: string, message: string): void {
    const byLower = new Map<string, string>();
    for (const nick of users.keys()) byLower.set(nick.toLowerCase(), nick);
    for (const to of extractMentions(message, byLower, from.toLowerCase())) {
      const fromMap = mentions.get(from) ?? new Map<string, number>();
      fromMap.set(to, (fromMap.get(to) ?? 0) + 1);
      mentions.set(from, fromMap);
    }
  }

  // Carry a nick's mention tallies across a rename, on both the `from` (outgoing)
  // and `to` (incoming) sides, so a rename mid-window neither drops nor splits a
  // pair's history. A rename that collides into a self-pair is dropped at flush.
  function renameMentions(oldNick: string, newNick: string): void {
    if (oldNick === newNick) return;
    const out = mentions.get(oldNick);
    if (out) {
      const dest = mentions.get(newNick) ?? new Map<string, number>();
      for (const [to, n] of out) dest.set(to, (dest.get(to) ?? 0) + n);
      mentions.set(newNick, dest);
      mentions.delete(oldNick);
    }
    for (const tos of mentions.values()) {
      const n = tos.get(oldNick);
      if (n !== undefined) {
        tos.set(newNick, (tos.get(newNick) ?? 0) + n);
        tos.delete(oldNick);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Flush to korin API
  // ---------------------------------------------------------------------------

  async function flush(): Promise<void> {
    const windowEnd = now();

    // Flatten the directional mention tallies into wire rows, dropping any self-pair
    // a nick-rename collision may have produced (issue #42).
    const interactions: Array<{ from: string; to: string; mentionCount: number }> = [];
    for (const [from, tos] of mentions) {
      for (const [to, mentionCount] of tos) {
        if (from === to) continue;
        interactions.push({ from, to, mentionCount });
      }
    }

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
          channelMessages: Object.fromEntries(u.channelMessages),
          windowStart,
          windowEnd,
        };
      }),
      interactions,
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
      registered = true;
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
        // Mention tallies are keyed on the nick too — move them with the user.
        renameMentions(event.nick, event.new_nick);
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
      if (event.target.startsWith('#')) {
        u.channels.add(event.target);
        u.channelMessages.set(event.target, (u.channelMessages.get(event.target) ?? 0) + 1);
      }
      // Tally pairwise mentions (issue #42). Runs after getOrCreate so the sender is
      // in the roster; extractMentions skips the sender so it's never a self-pair.
      recordMentions(event.nick, event.message);
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
      registered = false;
      scheduleReconnect();
    });

    client.on('error', (err: unknown) => {
      console.error('[bridge] irc error:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Delivery (ADR-006)
  // ---------------------------------------------------------------------------

  function deliver(channel: string, message: string): DeliverOutcome {
    // Only channels the bridge has joined. client.say() takes a NICK target just as
    // readily as a channel, so an unvalidated target would turn the bot into an
    // arbitrary-message relay — and it holds oper privileges (packages/irc/ergo.yaml).
    if (!config.channels.includes(channel)) return { ok: false, reason: 'not-joined' };
    if (!registered) return { ok: false, reason: 'not-connected' };
    client.say(channel, message);
    return { ok: true };
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

  return { start, flush, stop, deliver };
}
