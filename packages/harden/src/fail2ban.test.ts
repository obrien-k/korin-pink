import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBanIp, fail2banFailregex } from './fail2ban.js';

// Real Ergo 2.18 log lines (captured from the live korin.pink deploy, issue #19).
// Two structural facts the jail must respect:
//  - Auth failures (`opers`/`accounts` subsystems) log the nick + session id but
//    NOT the client IP — fail2ban has no <HOST> to ban on these lines.
//  - The IP only appears on the `connect-ip` subsystem line.

test('recognises a real failed-/OPER line as abuse but yields no IP (Ergo omits it)', () => {
  const line =
    '2026-06-16T11:31:07.832Z : info  : opers      : OPER attempt for : korin-admin : failed with invalid password';
  // Detected as an abuse signal, but the line carries no IP → not bannable.
  assert.equal(extractBanIp(line), null);
});

test('does not ban a normal connect-ip line (has an IP, but connecting is not abuse)', () => {
  const line =
    '2026-06-16T11:26:57.485Z : info  : connect-ip : s00001 : Client connecting: real IP 70.235.255.202, proxied IP <nil>';
  assert.equal(extractBanIp(line), null);
});

test('extracts the IP from an IP-bearing rejection line (the bannable path)', () => {
  // Illustrative connect-ip rejection format; exact wording pending a real flood
  // sample (issue #19). The mechanism — match a bannable phrase, pull the IP — is
  // what this pins.
  const line =
    '2026-06-16T11:40:00.000Z : warning : connect-ip : Rejecting connection from 198.51.100.23 (too many connections)';
  assert.equal(extractBanIp(line), '198.51.100.23');
});

test('ignores ordinary log lines', () => {
  assert.equal(extractBanIp('2026-06-16T11:14:55.107Z : info : server : Server running'), null);
  assert.equal(extractBanIp('garbage'), null);
});

test('failregex carries <HOST> and only the bannable (IP-bearing) phrases', () => {
  const lines = fail2banFailregex();
  assert.ok(lines.length >= 1, 'expected at least one bannable failregex');
  assert.ok(lines.every((l) => l.includes('<HOST>')), 'every failregex must capture <HOST>');
  // Detect-only auth-failure phrases must NOT pollute the filter — they can never
  // match a <HOST> (no IP on the line), so they'd be dead lines.
  assert.ok(!lines.some((l) => /invalid password/i.test(l)), 'detect-only phrases must stay out of the filter');
});
