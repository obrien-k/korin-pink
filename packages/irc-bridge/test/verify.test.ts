import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVerifyCommand,
  formatVerifyReply,
} from '../src/verify.js';

test('parseVerifyCommand: extracts the code from a well-formed command', () => {
  assert.equal(parseVerifyCommand('!verify ABCD2345'), 'ABCD2345');
  assert.equal(parseVerifyCommand('  !verify ABCD2345  '), 'ABCD2345');
  assert.equal(parseVerifyCommand('!VERIFY abcd'), 'abcd'); // command is case-insensitive
});

test('parseVerifyCommand: rejects non-verify or malformed messages', () => {
  assert.equal(parseVerifyCommand('hello'), null);
  assert.equal(parseVerifyCommand('!verify'), null); // no code
  assert.equal(parseVerifyCommand('!verify a b'), null); // more than one argument
  assert.equal(parseVerifyCommand('please !verify x'), null); // not at the start
});

test('formatVerifyReply: success names the now-linked nick', () => {
  const msg = formatVerifyReply('Alice', { verified: true });
  assert.match(msg, /Alice/);
  assert.match(msg, /linked/i);
});

test('formatVerifyReply: failure surfaces the reason', () => {
  assert.match(formatVerifyReply('Alice', { verified: false, reason: 'expired' }), /expired/);
});

test('formatVerifyReply: failure without a reason falls back to a default', () => {
  assert.match(formatVerifyReply('Alice', { verified: false }), /failed/i);
});
