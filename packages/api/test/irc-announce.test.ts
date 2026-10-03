import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { renderIrcAnnounce } from '../src/lib/rss.js';
import { BridgeDeliveryError, type BridgeClient } from '../src/lib/bridge.js';
import type { Config } from '../src/config.js';

// ── renderIrcAnnounce (ADR-006) ───────────────────────────────────────────────

const artifact = {
  title: 'Some Release Title',
  link: 'https://stellar.test/c/4821',
  description: 'a description that never reaches IRC',
  pubDate: 'Wed, 23 Jul 2026 10:00:00 GMT',
  category: 'release' as const,
};

test('renderIrcAnnounce: category tag, title, and the URL — no ANSI, no emoji', () => {
  const line = renderIrcAnnounce(artifact);

  assert.equal(line, '[RELEASE] Some Release Title - https://stellar.test/c/4821');
  // The whole point of not reusing renderMinimalIrc: no terminal escapes, and the
  // link is present unconditionally rather than only under osc8.
  assert.ok(!line.includes('\u001b'), 'no ANSI escape sequences');
  assert.ok(line.includes(artifact.link));
});

test('renderIrcAnnounce: strips control characters that would become extra PRIVMSGs', () => {
  const line = renderIrcAnnounce({
    ...artifact,
    title: 'Innocent\r\nPRIVMSG #ops :owned\u0002bold\u0003color',
  });

  assert.ok(!/[\u0000-\u001f\u007f]/.test(line), 'no control characters survive');
  assert.equal(line.split('\n').length, 1, 'renders as exactly one line');
  assert.ok(line.startsWith('[RELEASE] Innocent PRIVMSG #ops :owned'));
});

test('renderIrcAnnounce: truncates the title so the line fits one PRIVMSG', () => {
  const line = renderIrcAnnounce({ ...artifact, title: 'A'.repeat(2000) });

  assert.ok(Buffer.byteLength(line) <= 320, `line was ${Buffer.byteLength(line)} bytes`);
  // The link is load-bearing — it survives truncation, the title gives ground.
  assert.ok(line.endsWith(artifact.link));
  assert.ok(line.includes('…'));
});

test('renderIrcAnnounce: truncation never splits a multi-byte character', () => {
  const line = renderIrcAnnounce({ ...artifact, title: '日'.repeat(500) });

  assert.ok(Buffer.byteLength(line) <= 320);
  assert.ok(!line.includes('�'), 'no replacement characters from a split rune');
});

// ── POST /irc/announce delivery (ADR-006) ─────────────────────────────────────

const config = {
  port: 3000,
  stellarPullKey: 'pull-key',
  announceChannel: '#announce',
} as Config;

const feed = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title>Some Release Title</title>
    <link>https://stellar.test/c/4821</link>
    <description>a description</description>
    <category>release</category>
    <pubDate>Wed, 23 Jul 2026 10:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

function announce(app: ReturnType<typeof buildServer>) {
  return app.inject({
    method: 'POST',
    url: '/irc/announce',
    headers: { 'x-pull-key': 'pull-key' },
    payload: { xmlPayload: feed, templateType: 'minimal', environment: { osc8: false } },
  });
}

test('POST /irc/announce: delivers the IRC-rendered line to the configured channel', async () => {
  const said: Array<{ channel: string; message: string }> = [];
  const bridge: BridgeClient = {
    async say(channel, message) {
      said.push({ channel, message });
    },
  };

  const app = buildServer(config, { bridge });
  const res = await announce(app);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(said, [
    { channel: '#announce', message: '[RELEASE] Some Release Title - https://stellar.test/c/4821' },
  ]);
  // The response shape is unchanged — stellar discards it, but delivery is the
  // new part, not the contract.
  assert.equal(res.json().success, true);
  assert.equal(res.json().mode, 'minimal');
});

test('POST /irc/announce: 503 when the line cannot be delivered, so stellar retries', async () => {
  const bridge: BridgeClient = {
    async say() {
      throw new BridgeDeliveryError(503, 'bridge is not connected to IRC');
    },
  };

  const app = buildServer(config, { bridge });
  const res = await announce(app);

  // stellar's runAnnounceCycle holds its cursor on any non-2xx and re-pushes
  // this item next cycle — the 503 is what activates that.
  assert.equal(res.statusCode, 503);
  assert.match(res.json().error, /not connected/);
});

test('POST /irc/announce: an unexpected delivery error still fails closed as 503', async () => {
  const bridge: BridgeClient = {
    async say() {
      throw new Error('socket hang up');
    },
  };

  const app = buildServer(config, { bridge });
  const res = await announce(app);

  assert.equal(res.statusCode, 503);
});

test('POST /irc/announce: a feed with no artifacts is rejected before any delivery', async () => {
  let called = false;
  const bridge: BridgeClient = {
    async say() {
      called = true;
    },
  };

  const app = buildServer(config, { bridge });
  const res = await app.inject({
    method: 'POST',
    url: '/irc/announce',
    headers: { 'x-pull-key': 'pull-key' },
    payload: {
      xmlPayload:
        '<?xml version="1.0"?><rss version="2.0"><channel><title>empty</title></channel></rss>',
      templateType: 'minimal',
      environment: { osc8: false },
    },
  });

  assert.equal(res.statusCode, 422);
  assert.equal(called, false, 'nothing is said to IRC when there is nothing to announce');
});

// ── target routing (stellar-api ADR-0030 Decision 3, korin ADR-007) ──────────

function announceWith(app: ReturnType<typeof buildServer>, target: unknown) {
  return app.inject({
    method: 'POST',
    url: '/irc/announce',
    headers: { 'x-pull-key': 'pull-key' },
    payload: {
      xmlPayload: feed,
      templateType: 'minimal',
      environment: { osc8: false },
      target,
    } as Record<string, unknown>,
  });
}

function recordingBridge(fail?: Error) {
  const said: string[] = [];
  const bridge: BridgeClient = {
    async say(channel) {
      said.push(channel);
      if (fail) throw fail;
    },
    async setChannelAcl() {},
  };
  return { bridge, said };
}

test('POST /irc/announce: a PRIVATE target goes to its community channel only', async () => {
  const { bridge, said } = recordingBridge();
  const res = await announceWith(buildServer(config, { bridge }), { visibility: 'PRIVATE', community: 7 });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(said, ['#c-7']);
});

test('POST /irc/announce: a PUBLIC target, or none, goes to the public channel', async () => {
  const { bridge, said } = recordingBridge();
  const app = buildServer(config, { bridge });
  await announceWith(app, { visibility: 'PUBLIC', community: 7 });
  await announceWith(app, undefined);

  assert.deepEqual(said, ['#announce', '#announce']);
});

test('POST /irc/announce: a PRIVATE channel not projected yet is a 503 — never a fallback to the public channel', async () => {
  const { bridge, said } = recordingBridge(new BridgeDeliveryError(503, '#c-7 has not been projected yet'));
  const res = await announceWith(buildServer(config, { bridge }), { visibility: 'PRIVATE', community: 7 });

  assert.equal(res.statusCode, 503);
  assert.deepEqual(said, ['#c-7'], 'one attempt, to the private channel, and no second say to #announce');
});

test('POST /irc/announce: malformed targets are 400s and deliver nothing', async () => {
  const { bridge, said } = recordingBridge();
  const app = buildServer(config, { bridge });

  for (const target of [
    { visibility: 'PRIVATE' },
    { visibility: 'SECRET', community: 7 },
    { visibility: 'PRIVATE', community: 0 },
    { visibility: 'PRIVATE', community: 7, channel: '#announce' },
  ]) {
    assert.equal((await announceWith(app, target)).statusCode, 400, JSON.stringify(target));
  }
  assert.deepEqual(said, []);
});

test('POST /irc/announce: an empty reserved channel is accepted and ignored', async () => {
  const { bridge, said } = recordingBridge();
  const res = await announceWith(buildServer(config, { bridge }), {
    visibility: 'PRIVATE',
    community: 7,
    channel: '',
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(said, ['#c-7']);
});
