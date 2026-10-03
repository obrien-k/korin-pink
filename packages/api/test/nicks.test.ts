import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeNicks, isValidNick } from '../src/lib/nicks.js';
import { VALID_NICKS, INVALID_NICKS } from '../../irc-bridge/test/nick-cases.js';

// The api and the bridge each check projected nicks (ADR-007). They are tested
// against the SAME cases, imported from the bridge's test, so they cannot drift:
// an api that accepted what the bridge refuses would 503 a valid-looking set.

test('isValidNick (api): accepts every nick the bridge accepts', () => {
  for (const nick of VALID_NICKS) assert.ok(isValidNick(nick), nick);
});

test('isValidNick (api): refuses every nick the bridge refuses', () => {
  for (const nick of INVALID_NICKS) assert.ok(!isValidNick(nick), JSON.stringify(nick));
});

test('dedupeNicks (api): casefolds, keeping the first spelling', () => {
  assert.deepEqual(dedupeNicks(['Kai', 'kai', 'bob']), ['Kai', 'bob']);
});
