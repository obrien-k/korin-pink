import { Client } from 'irc-framework';
import {
  parseVerifyCommand,
  formatVerifyReply,
  VERIFY_UNAVAILABLE,
  type VerifyOutcome,
} from './verify.js';
import { fetchStellarId } from './resolve.js';

// ---------------------------------------------------------------------------
// Config — all from env, sane defaults for local dev
// ---------------------------------------------------------------------------

const IRC_HOST = process.env.IRC_HOST ?? 'localhost';
const IRC_PORT = parseInt(process.env.IRC_PORT ?? '6697', 10);
const IRC_TLS = (process.env.IRC_TLS ?? 'true') !== 'false';
const IRC_NICK = process.env.IRC_NICK ?? 'stellar-bridge';
const IRC_SASL_USER = process.env.IRC_SASL_USER ?? '';
const IRC_SASL_PASS = process.env.IRC_SASL_PASS ?? '';
const KORIN_API_URL = process.env.KORIN_API_URL ?? 'http://localhost:3000';
const IRC_BRIDGE_SECRET = process.env.IRC_BRIDGE_SECRET ?? '';
const FLUSH_INTERVAL_MS = parseInt(process.env.FLUSH_INTERVAL_MS ?? '60000', 10);

// ---------------------------------------------------------------------------
// Per-user activity accumulators for the current flush window
// ---------------------------------------------------------------------------

interface UserActivity {
  nick: string;
  stellarId?: string;
  stellarResolved: boolean;  // korin gave a definitive answer (linked or not)
  joinedAt: number | null;   // unix ms — null when offline
  presenceMs: number;        // accumulated across joins in this window
  messageCount: number;
  channels: Set<string>;
}

const windowStart = Date.now();
const users = new Map<string, UserActivity>();

// Nicks with an in-flight resolution, so concurrent sightings don't double-fetch.
const resolving = new Set<string>();

function getOrCreate(nick: string): UserActivity {
  if (!users.has(nick)) {
    users.set(nick, {
      nick,
      stellarResolved: false,
      joinedAt: null,
      presenceMs: 0,
      messageCount: 0,
      channels: new Set(),
    });
  }
  return users.get(nick)!;
}

// Resolve a nick to its Stellar id via korin and cache it on the record. A miss
// (no linked account) still counts as resolved — stellarId stays absent and the
// nick flushes as raw activity. An error leaves it unresolved to retry on the
// next sighting; resolution never blocks or crashes the bridge.
async function resolveStellarId(u: UserActivity): Promise<void> {
  if (u.stellarResolved || resolving.has(u.nick)) return;
  resolving.add(u.nick);
  try {
    const stellarId = await fetchStellarId(KORIN_API_URL, IRC_BRIDGE_SECRET, u.nick);
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
  if (u.joinedAt === null) u.joinedAt = Date.now();
  if (channel) u.channels.add(channel);
  void resolveStellarId(u);
}

function markOffline(nick: string): void {
  const u = getOrCreate(nick);
  if (u.joinedAt !== null) {
    u.presenceMs += Date.now() - u.joinedAt;
    u.joinedAt = null;
  }
}

// ---------------------------------------------------------------------------
// Flush to korin API
// ---------------------------------------------------------------------------

async function flush(): Promise<void> {
  const windowEnd = Date.now();
  const now = windowEnd;

  const payload = {
    users: [...users.values()].map((u) => {
      // Seal any still-online presence time for this window snapshot
      const totalPresenceMs = u.presenceMs + (u.joinedAt !== null ? now - u.joinedAt : 0);
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
    const res = await fetch(`${KORIN_API_URL}/irc/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-secret': IRC_BRIDGE_SECRET,
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

// ---------------------------------------------------------------------------
// IRC client
// ---------------------------------------------------------------------------

const client = new Client();

client.connect({
  host: IRC_HOST,
  port: IRC_PORT,
  tls: IRC_TLS,
  nick: IRC_NICK,
  username: IRC_NICK,
  gecos: 'Stellar IRC Bridge',
  ...(IRC_SASL_USER && IRC_SASL_PASS
    ? {
        account: {
          account: IRC_SASL_USER,
          password: IRC_SASL_PASS,
        },
      }
    : {}),
});

client.on('registered', () => {
  console.log(`[bridge] connected to ${IRC_HOST}:${IRC_PORT} as ${IRC_NICK}`);
  // Use WHO to get current channel membership on connect
  client.raw('WHO * %nuha');
});

client.on('join', (event: { nick: string; channel: string }) => {
  if (event.nick === IRC_NICK) return; // ignore self
  markOnline(event.nick, event.channel);
});

client.on('part', (event: { nick: string; channel: string }) => {
  if (event.nick === IRC_NICK) return;
  const u = getOrCreate(event.nick);
  u.channels.delete(event.channel);
  if (u.channels.size === 0) markOffline(event.nick);
});

client.on('quit', (event: { nick: string }) => {
  markOffline(event.nick);
});

client.on('nick', (event: { nick: string; new_nick: string }) => {
  // Carry state over to new nick
  if (users.has(event.nick)) {
    const u = users.get(event.nick)!;
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
  if (event.nick === IRC_NICK) return;

  // ADR-0015: a private "!verify <code>" to the bot is a control-plane command,
  // not IRCScore activity. Only honoured in a private query (target is the bot),
  // never a channel — so a code is never leaked into a channel.
  if (event.target === IRC_NICK) {
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

// Relay a verify command to korin (which proxies to stellar) and whisper the
// outcome back privately. korin owns the (nick, code) match; the bridge only
// reports the authenticated sender nick.
async function handleVerify(fromNick: string, code: string): Promise<void> {
  try {
    const res = await fetch(`${KORIN_API_URL}/irc/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-secret': IRC_BRIDGE_SECRET,
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

client.on('wholist', (event: { users: Array<{ nick: string; channel: string }> }) => {
  for (const entry of event.users) {
    if (entry.nick === IRC_NICK) continue;
    markOnline(entry.nick, entry.channel);
  }
});

client.on('socket close', () => {
  console.warn('[bridge] socket closed — reconnecting in 10s');
  setTimeout(() => client.connect(), 10_000);
});

client.on('error', (err: unknown) => {
  console.error('[bridge] irc error:', err);
});

// ---------------------------------------------------------------------------
// Flush loop
// ---------------------------------------------------------------------------

const flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`[bridge] ${signal} — flushing and shutting down`);
  clearInterval(flushTimer);
  // Mark all online users offline before final flush
  for (const u of users.values()) markOffline(u.nick);
  await flush();
  client.quit('bridge shutting down');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log(`[bridge] starting — ${IRC_HOST}:${IRC_PORT} tls=${IRC_TLS} flush=${FLUSH_INTERVAL_MS}ms`);
