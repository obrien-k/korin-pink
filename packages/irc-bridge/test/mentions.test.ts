import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMentions } from '../src/mentions.js';

// Roster index: lowercased nick → canonical. Bob and Carol are tracked; Zed is not.
const roster = new Map<string, string>([
  ['bob', 'Bob'],
  ['carol', 'Carol'],
]);

test('matches a standalone nick regardless of surrounding punctuation', () => {
  assert.deepEqual(extractMentions('Bob: hello', roster, 'alice'), ['Bob']);
  assert.deepEqual(extractMentions('thanks bob', roster, 'alice'), ['Bob']);
  assert.deepEqual(extractMentions('hey @bob, look', roster, 'alice'), ['Bob']);
  assert.deepEqual(extractMentions('nice one bob!', roster, 'alice'), ['Bob']);
});

test('is case-insensitive but returns the canonical tracked nick', () => {
  assert.deepEqual(extractMentions('BOB and CaRoL here', roster, 'alice'), ['Bob', 'Carol']);
});

test('does not match a nick as a substring of a larger token', () => {
  assert.deepEqual(extractMentions('bobby was here', roster, 'alice'), []);
  assert.deepEqual(extractMentions('discarol', roster, 'alice'), []);
});

test('ignores nicks that are not tracked', () => {
  assert.deepEqual(extractMentions('zed: hi', roster, 'alice'), []);
});

test('never counts a self-mention', () => {
  // Bob talking about himself does not produce a Bob→Bob pair.
  assert.deepEqual(extractMentions('I, bob, agree', roster, 'bob'), []);
});

test('dedupes repeated mentions of the same nick within one message', () => {
  assert.deepEqual(extractMentions('bob bob BOB', roster, 'alice'), ['Bob']);
});

test('empty / mention-free message yields no mentions', () => {
  assert.deepEqual(extractMentions('', roster, 'alice'), []);
  assert.deepEqual(extractMentions('just some words', roster, 'alice'), []);
});
