import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchStellarId } from '../src/resolve.js';

const API = 'http://korin.test';
const SECRET = 'bridge-secret';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('fetchStellarId: linked nick → the stellarId string, with the bridge secret', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ nick: 'Alice', stellarId: '42' });
  }) as typeof fetch;

  const id = await fetchStellarId(API, SECRET, 'Alice', fakeFetch);
  assert.equal(id, '42');
  assert.equal(calls[0].url, 'http://korin.test/irc/users/Alice/stellar-id');
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers['x-bridge-secret'], SECRET);
});

test('fetchStellarId: unlinked nick → null (a definitive answer, not an error)', async () => {
  const fakeFetch = (async () => jsonResponse({ nick: 'Bob', stellarId: null })) as typeof fetch;
  assert.equal(await fetchStellarId(API, SECRET, 'Bob', fakeFetch), null);
});

test('fetchStellarId: nick is URL-encoded', async () => {
  let seen = '';
  const fakeFetch = (async (url: string | URL) => {
    seen = String(url);
    return jsonResponse({ nick: 'a b', stellarId: null });
  }) as typeof fetch;
  await fetchStellarId(API, SECRET, 'a b', fakeFetch);
  assert.equal(seen, 'http://korin.test/irc/users/a%20b/stellar-id');
});

test('fetchStellarId: a non-200 throws so the caller retries rather than mislinks', async () => {
  const fakeFetch = (async () => jsonResponse({ error: 'boom' }, 502)) as typeof fetch;
  await assert.rejects(() => fetchStellarId(API, SECRET, 'Alice', fakeFetch), /korin stellar-id 502/);
});
