/**
 * End-to-end smoke for the irc-bridge (#20).
 *
 * Boots the full stack — Ergo + korin api + bridge — via
 * infra/docker-compose.smoke.yml, registers the `stellar-bridge` Ergo account,
 * drives synthetic channel traffic from a second IRC client, waits one short flush
 * window, then asserts korin's GET /irc/metrics returns populated, well-formed raw
 * signals. Proves the IRC → metrics → stellar PULL path (ADR-0013) actually runs.
 *
 * On demand only (not a CI gate): `npm run smoke` from packages/irc-bridge.
 * Requires Docker. Tears the stack down (and wipes its volume) in a finally.
 *
 * stellar-api is NOT wired here, so the bridge's nick → stellarId lookup 502s and
 * stellarId is absent — by design. The smoke asserts the RAW signals (presence,
 * messages, channels, window bounds); attribution is stellar-api's job (ADR-0013).
 */

import { Client } from 'irc-framework';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const execFileAsync = promisify(execFile);

// ── Stack coordinates (must match infra/docker-compose.smoke.yml) ────────────
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const COMPOSE = resolve(repoRoot, 'infra/docker-compose.smoke.yml');
const IRC_HOST = '127.0.0.1';
const IRC_PORT = 16667;
const API_URL = 'http://127.0.0.1:13000';
const PULL_KEY = 'smoke-pull-key';
const BRIDGE_NICK = 'stellar-bridge';
const BRIDGE_PASS = 'smoke-bridge-pass';
const CHANNEL = '#stellar';
const TESTER_NICK = 'smoke-tester';
const FLUSH_MS = 3000;

// ── Small helpers ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(msg: string): void {
  console.log(`[smoke] ${msg}`);
}

async function compose(...args: string[]): Promise<void> {
  await execFileAsync('docker', ['compose', '-f', COMPOSE, ...args], {
    cwd: repoRoot,
    timeout: 600_000,
  });
}

async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 90_000,
  intervalMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check().catch(() => false)) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(intervalMs);
  }
}

function tcpOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.setTimeout(2000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

async function httpOk(url: string): Promise<boolean> {
  const res = await fetch(url);
  return res.ok;
}

/** Connect a plaintext IRC client and resolve once it's registered (001 seen). */
function connectClient(nick: string, account?: { account: string; password: string }): Promise<Client> {
  const client = new Client();
  return new Promise((resolveClient, reject) => {
    const timer = setTimeout(() => reject(new Error(`${nick} never registered (SASL/connect failed?)`)), 30_000);
    client.on('registered', () => {
      clearTimeout(timer);
      resolveClient(client);
    });
    client.on('error', (err: unknown) => {
      clearTimeout(timer);
      reject(new Error(`${nick} irc error: ${String(err)}`));
    });
    client.connect({
      host: IRC_HOST,
      port: IRC_PORT,
      tls: false,
      nick,
      username: nick,
      gecos: nick,
      ...(account ? { account } : {}),
    });
  });
}

/** Register the bridge account via NickServ (idempotent — "already exists" is fine). */
async function registerBridgeAccount(): Promise<void> {
  const client = await connectClient(BRIDGE_NICK);
  try {
    const outcome = await new Promise<string>((resolveNotice, reject) => {
      const timer = setTimeout(() => reject(new Error('NickServ never replied to REGISTER')), 15_000);
      client.on('notice', (event: { nick?: string; message: string }) => {
        if ((event.nick ?? '').toLowerCase() !== 'nickserv') return;
        clearTimeout(timer);
        resolveNotice(event.message);
      });
      client.say('NickServ', `REGISTER ${BRIDGE_PASS}`);
    });
    log(`NickServ: ${outcome}`);
    const ok = /registered|created|logged in|success|already|exist/i.test(outcome);
    if (!ok) throw new Error(`account registration failed: ${outcome}`);
  } finally {
    client.quit('registration done');
    await sleep(1500); // let the nick free up before the bridge claims it
  }
}

interface UserMetricsRow {
  nick: string;
  stellarId?: string;
  presenceSeconds: number;
  messageCount: number;
  channelCount: number;
  channels: string[];
  windowStart: number;
  windowEnd: number;
}

async function getMetrics(): Promise<UserMetricsRow[]> {
  const res = await fetch(`${API_URL}/irc/metrics`, { headers: { 'x-pull-key': PULL_KEY } });
  if (!res.ok) throw new Error(`GET /irc/metrics → ${res.status}`);
  const body = (await res.json()) as { users: UserMetricsRow[] };
  return body.users;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

// ── The smoke ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('building + starting ergo and api …');
  await compose('up', '-d', '--build', 'ergo', 'api');

  log('waiting for ergo :6667 and api /health …');
  await waitFor('ergo tcp', () => tcpOpen(IRC_HOST, IRC_PORT));
  await waitFor('api health', () => httpOk(`${API_URL}/health`));

  log('registering the stellar-bridge account …');
  await registerBridgeAccount();

  log('starting the bridge …');
  await compose('up', '-d', '--build', 'irc-bridge');

  log(`connecting tester ${TESTER_NICK} and waiting for the bridge to join ${CHANNEL} …`);
  const tester = await connectClient(TESTER_NICK);
  try {
    // Track who's in the channel so we only send once the bridge is a member —
    // it can't count messages sent before it joined.
    const members = new Set<string>();
    tester.on('userlist', (e: { channel: string; users: Array<{ nick: string }> }) => {
      if (e.channel === CHANNEL) for (const u of e.users) members.add(u.nick);
    });
    tester.on('join', (e: { nick: string; channel: string }) => {
      if (e.channel === CHANNEL) members.add(e.nick);
    });
    tester.raw('JOIN', CHANNEL);
    await waitFor(`bridge present in ${CHANNEL}`, async () => members.has(BRIDGE_NICK), 45_000, 1000);

    log('driving synthetic channel traffic …');
    // A beat of presence, then a few messages — gives presenceSeconds something to count.
    await sleep(2000);
    const messages = ['hello from the smoke', 'second line', 'third line'];
    for (const msg of messages) {
      tester.say(CHANNEL, msg);
      await sleep(250);
    }

    log('waiting one flush window and polling GET /irc/metrics …');
    // The accumulator is cumulative across windows, so poll until a flush reflects
    // ALL sent messages — the first flush can land mid-burst and undercount.
    let rows: UserMetricsRow[] = [];
    await waitFor(
      'a flush reflecting all sent messages',
      async () => {
        rows = await getMetrics();
        return rows.some((r) => r.nick === TESTER_NICK && r.messageCount >= messages.length);
      },
      FLUSH_MS * 8,
      1000,
    );

    // ── Assertions: the pulled metrics are populated and well-formed ────────────
    assert(rows.length > 0, 'users[] is non-empty');
    const me = rows.find((r) => r.nick === TESTER_NICK);
    assert(me, `${TESTER_NICK} present in users[]`);
    assert(me!.messageCount >= 3, `messageCount counts the sent lines (got ${me!.messageCount})`);
    assert(me!.channelCount >= 1, `channelCount is non-zero (got ${me!.channelCount})`);
    assert(me!.channels.includes(CHANNEL), `channels includes ${CHANNEL} (got ${me!.channels.join(',')})`);
    assert(me!.presenceSeconds >= 1, `presenceSeconds accrued (got ${me!.presenceSeconds})`);
    assert(me!.windowStart > 0 && me!.windowEnd >= me!.windowStart, 'window bounds are sane');

    log('PASS — bridge connected, accumulated, and flushed well-formed metrics:');
    log(JSON.stringify(me, null, 2));
  } finally {
    tester.quit('smoke done');
    await sleep(500);
  }
}

async function teardown(): Promise<void> {
  log('tearing down (down -v) …');
  await compose('down', '-v').catch((err) => log(`teardown warning: ${String(err)}`));
}

main()
  .then(async () => {
    await teardown();
    log('done.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`[smoke] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    // Dump bridge logs to make a failure diagnosable before teardown.
    await compose('logs', '--no-color', '--tail', '50', 'irc-bridge').catch(() => {});
    await teardown();
    process.exit(1);
  });
