/**
 * End-to-end run of private-community announce delivery (korin ADR-007,
 * stellar-api ADR-0030 / #328). On demand, never a CI gate. The runbook is
 * docs/deploy/e2e-private-channels.md.
 *
 * Drives real IRC clients against infra/docker-compose.e2e.yml (Ergo + korin api
 * + bridge on 26667/23000), while a local stellar-api on a THROWAWAY
 * `stellar_e2e` database projects membership and announces to it. The database
 * changes mid-run go through stellar-api's `npm run e2e:korin`, which refuses
 * any other database.
 *
 *   accounts   register the Ergo accounts (stellar-bridge, alice, bob, dave, mallory)
 *   run        the scenario: squat, ACL, private and public routing, removal,
 *              squat recovery; exits non-zero on any failed check
 *
 * Env for `run`: STELLAR_API_DIR (a stellar-api checkout) and
 * STELLAR_E2E_PSQL_URI (the stellar_e2e database the local stellar-api uses).
 */
import { Client } from 'irc-framework';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const HOST = '127.0.0.1';
const PORT = 26667;
const PASS = 'e2e-pass';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (m: string) => console.log(`[e2e] ${m}`);

let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
}

interface Bot {
  nick: string;
  client: Client;
  lines: Array<{ target: string; nick: string; message: string }>;
  numerics: string[];
  kicked: string[];
  joined: Set<string>;
}

function connect(nick: string, account?: { account: string; password: string }): Promise<Bot> {
  return new Promise((resolve, reject) => {
    const client = new Client({ auto_reconnect: false });
    const bot: Bot = { nick, client, lines: [], numerics: [], kicked: [], joined: new Set() };
    const timer = setTimeout(() => reject(new Error(`${nick} never registered`)), 30_000);
    client.on('registered', () => {
      clearTimeout(timer);
      resolve(bot);
    });
    client.on('privmsg', (e: { target: string; nick: string; message: string }) => bot.lines.push(e));
    client.on('raw', (e: { line: string; from_server: boolean }) => {
      const n = / (\d{3}) /.exec(e.line)?.[1];
      if (e.from_server && n) bot.numerics.push(`${n} ${e.line}`);
    });
    client.on('kick', (e: { kicked: string; channel: string }) => {
      if (e.kicked.toLowerCase() === nick.toLowerCase()) {
        bot.kicked.push(e.channel);
        bot.joined.delete(e.channel.toLowerCase());
      }
    });
    client.on('join', (e: { nick: string; channel: string }) => {
      if (e.nick.toLowerCase() === nick.toLowerCase()) bot.joined.add(e.channel.toLowerCase());
    });
    client.connect({ host: HOST, port: PORT, tls: false, nick, username: nick, gecos: 'e2e', ...(account ? { account } : {}) });
  });
}

async function until(label: string, check: () => boolean | Promise<boolean>, ms = 60_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await sleep(500);
  }
  log(`timed out: ${label}`);
  return false;
}

/** JOIN, and report whether it took: joined, or refused with 473 (invite-only). */
async function tryJoin(bot: Bot, channel: string, ms = 5000): Promise<'joined' | 'refused' | 'unknown'> {
  const before = bot.numerics.length;
  bot.client.raw('JOIN', channel);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (bot.joined.has(channel.toLowerCase())) return 'joined';
    if (bot.numerics.slice(before).some((l) => l.startsWith('473 '))) return 'refused';
    await sleep(200);
  }
  return 'unknown';
}

/** stellar-api's guarded fixture script; its last stdout line is the result. */
async function helper(...args: string[]): Promise<string> {
  const cwd = process.env.STELLAR_API_DIR;
  const uri = process.env.STELLAR_E2E_PSQL_URI;
  if (!cwd || !uri) throw new Error('set STELLAR_API_DIR and STELLAR_E2E_PSQL_URI');
  const { stdout } = await exec('npm', ['run', '-s', 'e2e:korin', '--', ...args], {
    cwd,
    env: { ...process.env, STELLAR_PSQL_URI: uri },
    timeout: 120_000,
  });
  return stdout.trim().split('\n').at(-1) ?? '';
}

async function accounts(): Promise<void> {
  for (const [nick, password] of [
    ['stellar-bridge', 'smoke-bridge-pass'],
    ['alice', PASS],
    ['bob', PASS],
    ['dave', PASS],
    ['mallory', PASS],
  ]) {
    const bot = await connect(nick);
    const reply = new Promise<string>((resolve) => {
      bot.client.on('notice', (e: { nick: string; message: string }) => {
        if (/nickserv/i.test(e.nick)) resolve(e.message);
      });
    });
    bot.client.say('NickServ', `REGISTER ${password}`);
    log(`${nick}: ${await Promise.race([reply, sleep(10_000).then(() => 'no reply')])}`);
    bot.client.quit('registered');
  }
}

async function run(): Promise<void> {
  const acct = (nick: string) => ({ account: nick, password: PASS });
  const [alice, bob, dave, mallory] = await Promise.all(
    ['alice', 'bob', 'dave', 'mallory'].map((n) => connect(n, acct(n)))
  );

  // 1. Squat #c-2 before Squat Club goes PRIVATE: mallory creates it and holds op.
  check((await tryJoin(mallory, '#c-2')) === 'joined', 'mallory creates and squats #c-2 (Squat Club is still PUBLIC)');

  // 2. The first projection secures #c-1 (Private Club).
  const projected = await until('alice admitted to #c-1', async () => (await tryJoin(alice, '#c-1', 2000)) === 'joined', 90_000);
  check(projected, 'a verified member (alice) can join #c-1 once projected');
  check((await tryJoin(bob, '#c-1')) === 'joined', 'a second verified member (bob) can join #c-1');
  check((await tryJoin(dave, '#c-1')) === 'refused', 'a verified non-member (dave) is refused with 473');
  check((await tryJoin(mallory, '#c-1')) === 'refused', 'an unrelated user (mallory) is refused with 473');

  const modes = new Promise<string>((resolve) => {
    alice.client.on('raw', (e: { line: string }) => {
      if (/ 324 alice #c-1 /i.test(e.line)) resolve(e.line);
    });
  });
  alice.client.raw('MODE', '#c-1');
  const modeLine = await Promise.race([modes, sleep(5000).then(() => '')]);
  check(['i', 's', 'n', 't'].every((m) => /\+(\S+)/.exec(modeLine.split('#c-1')[1] ?? '')?.[1].includes(m)), `#c-1 is +inst (${modeLine.split('#c-1')[1]?.trim()})`);

  // 3. Private announce lands in #c-1, and not in #announce.
  check((await tryJoin(dave, '#announce')) === 'joined', 'dave listens in #announce');
  const privateItem = JSON.parse(await helper('contribute', '1'));
  const gotPrivate = await until('private line in #c-1', () =>
    alice.lines.some((l) => l.target.toLowerCase() === '#c-1' && l.message.includes('Private Club Album'))
  );
  check(gotPrivate, `contribution ${privateItem.contribution} (Private Club) announced in #c-1`);
  await sleep(3000);
  check(
    !dave.lines.some((l) => l.message.includes('Private Club Album')),
    'the Private Club line did NOT appear in #announce'
  );

  // 4. Public announce still goes to #announce.
  await helper('contribute', '3');
  check(
    await until('public line in #announce', () =>
      dave.lines.some((l) => l.target.toLowerCase() === '#announce' && l.message.includes('Open House Album'))
    ),
    'an Open House (PUBLIC) contribution is announced in #announce'
  );

  // 5. Removing bob from Private Club kicks him on the next tick.
  await helper('remove-consumer', '1', 'bob');
  check(await until('bob kicked from #c-1', () => bob.kicked.includes('#c-1')), 'bob is kicked from #c-1 after removal');
  check((await tryJoin(bob, '#c-1')) === 'refused', 'and bob can no longer rejoin #c-1');

  // 6. Squat recovery: flipping Squat Club PRIVATE makes the bridge PURGE and register #c-2.
  await helper('set-private', '2');
  check(await until('mallory purged from #c-2', () => mallory.kicked.includes('#c-2'), 90_000), 'the squatter is cleared from #c-2 by ChanServ PURGE');
  check(
    await until('alice admitted to #c-2', async () => (await tryJoin(alice, '#c-2', 2000)) === 'joined', 90_000),
    'a Squat Club member (alice) can join the recovered #c-2'
  );
  check((await tryJoin(mallory, '#c-2')) === 'refused', 'the squatter is refused from the recovered #c-2');
  await helper('contribute', '2');
  check(
    await until('squat-club line in #c-2', () =>
      alice.lines.some((l) => l.target.toLowerCase() === '#c-2' && l.message.includes('Squat Club Album'))
    ),
    'a Squat Club contribution is announced in the recovered #c-2'
  );

  for (const b of [alice, bob, dave, mallory]) b.client.quit('e2e done');
  log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

const phase = process.argv[2];
(phase === 'accounts' ? accounts() : run()).catch((err) => {
  console.error(err);
  process.exit(2);
});
