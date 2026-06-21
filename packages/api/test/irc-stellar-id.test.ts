import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { StellarApiError, type StellarClient, type StellarUser } from '../src/lib/stellar.js';
import type { Config } from '../src/config.js';

// Config with the bridge secret set; stellar URL/key omitted so the default
// (real) client fails closed unless a stub is injected.
const config: Config = { port: 3000, ircBridgeSecret: 'bridge-secret' };

// A StellarClient stub that records getUserByNick calls and returns/throws on
// demand. The single upstream stub point — the route only ever asks stellar for
// getUserByNick, so the other methods are inert stubs.
function stubStellar(
  impl: (nick: string) => Promise<StellarUser | null>,
  calls: string[] = [],
): StellarClient {
  return {
    async getUserByNick(nick) {
      calls.push(nick);
      return impl(nick);
    },
    async linkNick() {},
    async getReputation() {
      return {};
    },
    async verifyNick() {
      return { verified: false };
    },
  };
}

const URL = '/irc/users/Alice/stellar-id';
const auth = { 'x-bridge-secret': 'bridge-secret' };

test('linked nick → { nick, stellarId } with the numeric id as a string', async () => {
  const calls: string[] = [];
  const app = buildServer(config, {
    stellar: stubStellar(async () => ({ id: 42, username: 'alice' }), calls),
  });
  try {
    const res = await app.inject({ method: 'GET', url: URL, headers: auth });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { nick: 'Alice', stellarId: '42' });
    assert.deepEqual(calls, ['Alice']);
  } finally {
    await app.close();
  }
});

test('unlinked nick → { stellarId: null } (not a 404)', async () => {
  const app = buildServer(config, { stellar: stubStellar(async () => null) });
  try {
    const res = await app.inject({ method: 'GET', url: URL, headers: auth });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { nick: 'Alice', stellarId: null });
  } finally {
    await app.close();
  }
});

test('missing x-bridge-secret → 401', async () => {
  const app = buildServer(config, { stellar: stubStellar(async () => null) });
  try {
    const res = await app.inject({ method: 'GET', url: URL });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('wrong x-bridge-secret → 401', async () => {
  const app = buildServer(config, { stellar: stubStellar(async () => null) });
  try {
    const res = await app.inject({
      method: 'GET',
      url: URL,
      headers: { 'x-bridge-secret': 'nope' },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('unset stellar config fails closed → 502 (the default client, no stub)', async () => {
  // No deps.stellar → the real client built from a config with no stellar URL/key,
  // which throws at call time. The route must surface that as 502, never null.
  const app = buildServer(config);
  try {
    const res = await app.inject({ method: 'GET', url: URL, headers: auth });
    assert.equal(res.statusCode, 502);
  } finally {
    await app.close();
  }
});

test('upstream failure (non-404) → 502 so the bridge retries rather than mislinks', async () => {
  const app = buildServer(config, {
    stellar: stubStellar(async () => {
      throw new StellarApiError(500, 'stellar-api 500');
    }),
  });
  try {
    const res = await app.inject({ method: 'GET', url: URL, headers: auth });
    assert.equal(res.statusCode, 502);
  } finally {
    await app.close();
  }
});
