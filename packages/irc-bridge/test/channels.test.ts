import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeNicks,
  isPrivateChannel,
  isValidNick,
  modeLines,
  parsePurgeCode,
  planAcl,
} from '../src/channels.js';
import { VALID_NICKS, INVALID_NICKS } from './nick-cases.js';

test('isValidNick: accepts what Ergo (ascii casemapping) allows', () => {
  for (const nick of VALID_NICKS) assert.ok(isValidNick(nick), nick);
});

test('isValidNick: refuses anything that could end, add or widen a MODE/KICK parameter', () => {
  for (const nick of INVALID_NICKS) assert.ok(!isValidNick(nick), JSON.stringify(nick));
});

test('isPrivateChannel: only #c-<positive id>', () => {
  for (const ok of ['#c-1', '#c-42', '#c-1000000']) assert.ok(isPrivateChannel(ok), ok);
  for (const no of ['#announce', '#c-', '#c-0', '#c-01', '#c-1a', '#c-1 #announce', 'c-1', '#C-1']) {
    assert.ok(!isPrivateChannel(no), no);
  }
});

test('planAcl: adds missing masks, removes every unwanted one, kicks non-members but never itself', () => {
  const plan = planAcl({
    nicks: ['alice', 'Bob'],
    currentMasks: ['ALICE!*@*', 'carol!*@*', 'someone!*@evil.host'],
    occupants: ['stellar-bridge', 'alice', 'carol', 'mallory'],
    self: 'Stellar-Bridge',
  });

  assert.deepEqual(plan.add, ['Bob!*@*']);
  assert.deepEqual(plan.remove, ['carol!*@*', 'someone!*@evil.host']);
  assert.deepEqual(plan.kick, ['carol', 'mallory']);
});

test('planAcl: an empty set clears the list and empties the channel, except the bridge', () => {
  const plan = planAcl({
    nicks: [],
    currentMasks: ['alice!*@*'],
    occupants: ['stellar-bridge', 'alice'],
    self: 'stellar-bridge',
  });
  assert.deepEqual(plan, { add: [], remove: ['alice!*@*'], kick: ['alice'] });
});

test('modeLines: batches modes, one sign per line', () => {
  assert.deepEqual(modeLines('#c-1', '+', 'I', ['a', 'b', 'c', 'd', 'e']), [
    ['MODE', '#c-1', '+IIII', 'a', 'b', 'c', 'd'],
    ['MODE', '#c-1', '+I', 'e'],
  ]);
  assert.deepEqual(modeLines('#c-1', '-', 'I', []), []);
});

test('dedupeNicks: casefolds, keeping the first spelling', () => {
  assert.deepEqual(dedupeNicks(['Kai', 'kai', 'KAI', 'bob']), ['Kai', 'bob']);
});

test('parsePurgeCode: reads the code for the channel asked about only', () => {
  const prompt = 'To confirm, run this command: /CS PURGE ADD #c-7 1a2b3c';
  assert.equal(parsePurgeCode(prompt, '#c-7'), '1a2b3c');
  assert.equal(parsePurgeCode(prompt, '#c-8'), null);
  assert.equal(parsePurgeCode('Warning: you are about to empty this channel', '#c-7'), null);
});
