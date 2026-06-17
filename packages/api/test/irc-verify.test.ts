import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStellarClient } from '../src/lib/stellar.js';
import { VerifyRelaySchema } from '../src/routes/irc.js';

// ── relay schema ──────────────────────────────────────────────────────────────

test('VerifyRelaySchema: accepts a nick + code, rejects blanks/missing', () => {
  assert.equal(VerifyRelaySchema.safeParse({ nick: 'Alice', code: 'ABCD2345' }).success, true);
  assert.equal(VerifyRelaySchema.safeParse({ nick: '', code: 'x' }).success, false);
  assert.equal(VerifyRelaySchema.safeParse({ nick: 'Alice' }).success, false);
});

// ── stellar client: verifyNick ────────────────────────────────────────────────

const stellarConfig = { stellarApiUrl: 'https://stellar.test', stellarApiKey: 'svc-key' };

test('verifyNick: POSTs (nick, code) to the stellar verify endpoint with Bearer auth', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ verified: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = createStellarClient(stellarConfig);
    const result = await client.verifyNick('Alice', 'ABCD2345');

    assert.deepEqual(result, { verified: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://stellar.test/api/users/irc-nick/verify');
    assert.equal(calls[0].init.method, 'POST');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer svc-key');
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      nick: 'Alice',
      code: 'ABCD2345',
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('verifyNick: relays a failed verification result without throwing (stellar 200s)', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ verified: false, reason: 'expired' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  try {
    const client = createStellarClient(stellarConfig);
    const result = await client.verifyNick('Alice', 'NOPE');
    assert.deepEqual(result, { verified: false, reason: 'expired' });
  } finally {
    globalThis.fetch = realFetch;
  }
});
