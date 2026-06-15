import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBanIp, fail2banFailregex } from './fail2ban.js';

test('flags a failed-auth line and extracts the source IP', () => {
  const line =
    '2026-06-15T22:00:00Z : accounts : info : Failed login to account bob from [203.0.113.7]:54321';
  assert.equal(extractBanIp(line), '203.0.113.7');
});

test('flags a throttled/rejected connection and extracts the IP', () => {
  const line =
    '2026-06-15T22:00:00Z : connect-ip : warning : Rejecting connection from 198.51.100.23 due to max-connections-per-duration';
  assert.equal(extractBanIp(line), '198.51.100.23');
});

test('ignores ordinary log lines', () => {
  assert.equal(extractBanIp('2026-06-15T22:00:00Z : server : info : Server running'), null);
  assert.equal(extractBanIp('garbage'), null);
});

test('does not ban a signal line that carries no IP', () => {
  assert.equal(extractBanIp('2026-06-15T22:00:00Z : accounts : info : Failed login to account bob'), null);
});

test('produces fail2ban failregex lines with the <HOST> token for each signal', () => {
  const lines = fail2banFailregex();
  assert.ok(lines.length >= 2, 'expected one failregex per signal');
  assert.ok(lines.every((l) => l.includes('<HOST>')), 'every failregex must capture <HOST>');
  assert.ok(lines.some((l) => /failed login/i.test(l)));
  assert.ok(lines.some((l) => /rejecting connection/i.test(l)));
});
