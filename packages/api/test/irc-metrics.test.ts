import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import type { Config } from '../src/config.js';

// Both guards are exercised: the bridge POSTs with x-bridge-secret, stellar pulls
// with x-pull-key. Set both so the round-trip is testable end to end.
const config: Config = {
  port: 3000,
  ircBridgeSecret: 'bridge-secret',
  stellarPullKey: 'pull-key',
};

const push = { 'x-bridge-secret': 'bridge-secret' };
const pull = { 'x-pull-key': 'pull-key' };

// A full #42-shaped flush: per-user channelMessages + top-level interactions.
const flush = {
  users: [
    {
      nick: 'Alice',
      stellarId: '42',
      presenceSeconds: 120,
      messageCount: 5,
      channelCount: 2,
      channels: ['#music', '#korin'],
      channelMessages: { '#music': 3, '#korin': 1 }, // sums to ≤ messageCount
      windowStart: 1_000,
      windowEnd: 2_000,
    },
  ],
  interactions: [{ from: 'Alice', to: 'Bob', mentionCount: 2 }],
};

test('POST flush → GET pull round-trips channelMessages and interactions', async () => {
  const app = buildServer(config);
  try {
    const post = await app.inject({ method: 'POST', url: '/irc/metrics', headers: push, payload: flush });
    assert.equal(post.statusCode, 200);
    assert.deepEqual(post.json(), { ok: true, accepted: 1 });

    const get = await app.inject({ method: 'GET', url: '/irc/metrics', headers: pull });
    assert.equal(get.statusCode, 200);
    const body = get.json() as typeof flush & { lastFlushAt: number };
    assert.deepEqual(body.users[0].channelMessages, { '#music': 3, '#korin': 1 });
    assert.deepEqual(body.interactions, [{ from: 'Alice', to: 'Bob', mentionCount: 2 }]);
    assert.equal(typeof body.lastFlushAt, 'number');
  } finally {
    await app.close();
  }
});

test('a pre-#42 bridge (no new fields) still validates; interactions defaults to []', async () => {
  const app = buildServer(config);
  try {
    const legacy = {
      users: [
        {
          nick: 'Bob',
          presenceSeconds: 30,
          messageCount: 1,
          channelCount: 1,
          channels: ['#korin'],
          windowStart: 1_000,
          windowEnd: 2_000,
        },
      ],
    };
    const post = await app.inject({ method: 'POST', url: '/irc/metrics', headers: push, payload: legacy });
    assert.equal(post.statusCode, 200);

    const get = await app.inject({ method: 'GET', url: '/irc/metrics', headers: pull });
    assert.deepEqual(get.json().interactions, []); // defaulted, never undefined
    assert.equal(get.json().users[0].channelMessages, undefined); // optional, absent
  } finally {
    await app.close();
  }
});

test('a malformed interaction (mentionCount ≤ 0) is rejected with 400', async () => {
  const app = buildServer(config);
  try {
    const bad = {
      users: [],
      interactions: [{ from: 'Alice', to: 'Bob', mentionCount: 0 }],
    };
    const res = await app.inject({ method: 'POST', url: '/irc/metrics', headers: push, payload: bad });
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('POST without x-bridge-secret → 401; GET without x-pull-key → 401', async () => {
  const app = buildServer(config);
  try {
    const post = await app.inject({ method: 'POST', url: '/irc/metrics', payload: flush });
    assert.equal(post.statusCode, 401);
    const get = await app.inject({ method: 'GET', url: '/irc/metrics' });
    assert.equal(get.statusCode, 401);
  } finally {
    await app.close();
  }
});
