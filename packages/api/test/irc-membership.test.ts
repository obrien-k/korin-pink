import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { BridgeDeliveryError, type BridgeClient } from '../src/lib/bridge.js';
import type { Config } from '../src/config.js';

// POST /irc/membership (korin ADR-007): stellar projects a private community's
// complete verified-nick set; korin validates it and hands it to the bridge.

const config = { port: 3000, stellarPullKey: 'pull-key', announceChannel: '#announce' } as Config;

function bridgeRecording(fail?: Error) {
  const calls: Array<{ channel: string; nicks: string[] }> = [];
  const bridge: BridgeClient = {
    async say() {},
    async setChannelAcl(channel, nicks) {
      calls.push({ channel, nicks });
      if (fail) throw fail;
    },
  };
  return { bridge, calls };
}

function project(app: ReturnType<typeof buildServer>, payload: unknown, key = 'pull-key') {
  return app.inject({
    method: 'POST',
    url: '/irc/membership',
    headers: { 'x-pull-key': key },
    payload: payload as Record<string, unknown>,
  });
}

test('POST /irc/membership: applies the deduped set to #c-<community> and answers 204', async () => {
  const { bridge, calls } = bridgeRecording();
  const res = await project(buildServer(config, { bridge }), {
    community: 7,
    nicks: ['alice', 'Alice', 'bob'],
  });

  assert.equal(res.statusCode, 204);
  assert.deepEqual(calls, [{ channel: '#c-7', nicks: ['alice', 'bob'] }]);
});

test('POST /irc/membership: an empty set is projected verbatim (it clears the channel)', async () => {
  const { bridge, calls } = bridgeRecording();
  const res = await project(buildServer(config, { bridge }), { community: 7, nicks: [] });

  assert.equal(res.statusCode, 204);
  assert.deepEqual(calls, [{ channel: '#c-7', nicks: [] }]);
});

test('POST /irc/membership: 401 without the pull key, before anything reaches the bridge', async () => {
  const { bridge, calls } = bridgeRecording();
  const res = await project(buildServer(config, { bridge }), { community: 7, nicks: [] }, 'wrong');

  assert.equal(res.statusCode, 401);
  assert.deepEqual(calls, []);
});

test('POST /irc/membership: 400 for a malformed body, an oversized set or any invalid nick', async () => {
  const { bridge, calls } = bridgeRecording();
  const app = buildServer(config, { bridge });

  for (const payload of [
    { nicks: [] },
    { community: 0, nicks: [] },
    { community: '7', nicks: [] },
    { community: 7 },
    { community: 7, nicks: Array.from({ length: 1001 }, (_, i) => `n${i}`) },
    { community: 7, nicks: ['alice', 'bob KICK #c-7 alice'] },
    { community: 7, nicks: ['alice', 'x\r\nQUIT'] },
  ]) {
    assert.equal((await project(app, payload)).statusCode, 400, JSON.stringify(payload).slice(0, 60));
  }
  assert.deepEqual(calls, [], 'no invalid set reaches the bridge');
});

test('POST /irc/membership: 503 when the bridge could not apply it, so the next tick retries', async () => {
  const { bridge } = bridgeRecording(new BridgeDeliveryError(503, 'projection not applied: not-oper'));
  const res = await project(buildServer(config, { bridge }), { community: 7, nicks: ['alice'] });

  assert.equal(res.statusCode, 503);
  assert.match(res.json().error, /not-oper/);
});

test('POST /irc/membership: an unexpected bridge error still answers 503', async () => {
  const { bridge } = bridgeRecording(new Error('socket hang up'));
  const res = await project(buildServer(config, { bridge }), { community: 7, nicks: [] });

  assert.equal(res.statusCode, 503);
});
