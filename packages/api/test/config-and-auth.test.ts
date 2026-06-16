import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { requireSharedSecret } from '../src/lib/auth.js';

// Minimal Fastify reply double — captures the status set by the guard.
function fakeReply() {
  return {
    statusCode: 0 as number,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    send(payload: unknown) { this.body = payload; return this; },
  };
}
const req = (headers: Record<string, string>) => ({ headers }) as never;

// ── config seam ──────────────────────────────────────────────────────────────

test('loadConfig: defaults port to 3000, leaves unset secrets undefined', () => {
  const c = loadConfig({});
  assert.equal(c.port, 3000);
  assert.equal(c.stellarPullKey, undefined);
  assert.equal(c.ircBridgeSecret, undefined);
});

test('loadConfig: reads PORT + secrets from env', () => {
  const c = loadConfig({ PORT: '8080', STELLAR_PULL_KEY: 'pk', IRC_BRIDGE_SECRET: 'bs' });
  assert.equal(c.port, 8080);
  assert.equal(c.stellarPullKey, 'pk');
  assert.equal(c.ircBridgeSecret, 'bs');
});

test('loadConfig: empty-string secret is treated as unset (fails closed, not boot)', () => {
  const c = loadConfig({ STELLAR_PULL_KEY: '' });
  assert.equal(c.stellarPullKey, undefined);
});

test('loadConfig: validates shape — a malformed STELLAR_API_URL throws at boot', () => {
  assert.throws(() => loadConfig({ STELLAR_API_URL: 'not-a-url' }));
});

// ── shared-secret guard ──────────────────────────────────────────────────────

test('requireSharedSecret: unset secret always 401s (fail-closed)', async () => {
  const reply = fakeReply();
  await requireSharedSecret('x-pull-key', undefined)(req({ 'x-pull-key': 'anything' }), reply as never);
  assert.equal(reply.statusCode, 401);
});

test('requireSharedSecret: wrong / missing header 401s', async () => {
  const wrong = fakeReply();
  await requireSharedSecret('x-pull-key', 'secret')(req({ 'x-pull-key': 'nope' }), wrong as never);
  assert.equal(wrong.statusCode, 401);

  const missing = fakeReply();
  await requireSharedSecret('x-pull-key', 'secret')(req({}), missing as never);
  assert.equal(missing.statusCode, 401);
});

test('requireSharedSecret: matching secret passes (no status set)', async () => {
  const reply = fakeReply();
  await requireSharedSecret('x-bridge-secret', 'secret')(req({ 'x-bridge-secret': 'secret' }), reply as never);
  assert.equal(reply.statusCode, 0); // guard did not reply → request proceeds
});
