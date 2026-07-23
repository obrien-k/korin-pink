import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleDeliverRequest, type DeliverHttpDeps } from '../src/deliver.js';
import type { DeliverOutcome } from '../src/bridge.js';

// ADR-006. handleDeliverRequest is pure, so every rule is assertable without
// binding a port or opening an IRC socket.

const SECRET = 'bridge-secret';

function deps(outcome: DeliverOutcome = { ok: true }): DeliverHttpDeps & {
  calls: Array<{ channel: string; message: string }>;
} {
  const calls: Array<{ channel: string; message: string }> = [];
  return {
    secret: SECRET,
    calls,
    deliver(channel, message) {
      calls.push({ channel, message });
      return outcome;
    },
  };
}

function req(overrides: Partial<Parameters<typeof handleDeliverRequest>[0]> = {}) {
  return {
    method: 'POST',
    path: '/say',
    secret: SECRET,
    rawBody: JSON.stringify({ channel: '#announce', message: '[RELEASE] Thing - https://x.test/1' }),
    ...overrides,
  };
}

test('delivers a well-formed, authenticated request', () => {
  const d = deps();
  const res = handleDeliverRequest(req(), d);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.deepEqual(d.calls, [
    { channel: '#announce', message: '[RELEASE] Thing - https://x.test/1' },
  ]);
});

test('401s a wrong or missing secret without attempting delivery', () => {
  for (const secret of ['wrong-secret', undefined, ['a', 'b']]) {
    const d = deps();
    const res = handleDeliverRequest(req({ secret }), d);

    assert.equal(res.status, 401, `secret=${JSON.stringify(secret)}`);
    assert.equal(d.calls.length, 0);
  }
});

test('fails closed when the bridge itself has no secret configured', () => {
  const d = { ...deps(), secret: '' };
  const res = handleDeliverRequest(req({ secret: '' }), d);

  assert.equal(res.status, 401);
});

test('404s anything that is not POST /say', () => {
  assert.equal(handleDeliverRequest(req({ method: 'GET' }), deps()).status, 404);
  assert.equal(handleDeliverRequest(req({ path: '/metrics' }), deps()).status, 404);
});

test('400s malformed JSON and missing fields', () => {
  assert.equal(handleDeliverRequest(req({ rawBody: 'not json' }), deps()).status, 400);
  assert.equal(handleDeliverRequest(req({ rawBody: '{}' }), deps()).status, 400);
  assert.equal(
    handleDeliverRequest(req({ rawBody: JSON.stringify({ channel: '#announce' }) }), deps()).status,
    400
  );
  assert.equal(
    handleDeliverRequest(req({ rawBody: JSON.stringify({ channel: '', message: 'x' }) }), deps())
      .status,
    400
  );
});

test('400s a channel the bridge has not joined — permanent, so stellar blocks on it', () => {
  const d = deps({ ok: false, reason: 'not-joined' });
  const res = handleDeliverRequest(req(), d);

  assert.equal(res.status, 400);
  assert.match(String(res.body.error), /has not joined/);
});

test('503s while the bridge is off IRC — transient, so stellar retries', () => {
  const d = deps({ ok: false, reason: 'not-connected' });
  const res = handleDeliverRequest(req(), d);

  assert.equal(res.status, 503);
  assert.match(String(res.body.error), /not connected/);
});
