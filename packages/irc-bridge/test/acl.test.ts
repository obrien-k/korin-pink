import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAclManager, type AclOutcome } from '../src/acl.js';
import type { IrcClient } from '../src/bridge.js';

// The projection is a conversation with Ergo (ADR-007). These tests play Ergo's
// side: each step waits until the bridge has sent its command, then answers
// with the event irc-framework would emit.

class FakeClient implements IrcClient {
  handlers = new Map<string, Array<(event: any) => void>>();
  rawCalls: string[][] = [];
  sayCalls: Array<{ target: string; message: string }> = [];

  on(event: string, handler: (event: any) => void): unknown {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  connect(): void {}
  who(): void {}
  raw(...args: string[]): void {
    this.rawCalls.push(args);
  }
  say(target: string, message: string): void {
    this.sayCalls.push({ target, message });
  }
  quit(): void {}
  emit(event: string, payload: unknown): void {
    for (const h of this.handlers.get(event) ?? []) h(payload);
  }
}

const SELF = 'stellar-bridge';
const CH = '#c-7';
const tick = () => new Promise((r) => setImmediate(r));

function setup(opts: { oper?: boolean; registered?: boolean; stepTimeoutMs?: number } = {}) {
  const client = new FakeClient();
  const acl = createAclManager({
    client,
    selfNick: SELF,
    isRegistered: () => opts.registered ?? true,
    stepTimeoutMs: opts.stepTimeoutMs ?? 1000,
  });
  acl.wire();
  if (opts.oper ?? true) {
    client.emit('raw', { line: `:irc.korin.pink 381 ${SELF} :You are now an IRC operator`, from_server: true });
  }
  return { client, acl };
}

const chanServ = (message: string) => ({ nick: 'ChanServ', target: SELF, message });
const names = (users: Array<{ nick: string; modes?: string[] }>) => ({ channel: CH, users });

/** Answer one projection the way Ergo would for a channel the bridge founded. */
async function answerHappyPath(
  client: FakeClient,
  opts: { occupants?: Array<{ nick: string; modes?: string[] }>; invites?: string[] } = {}
) {
  await tick();
  client.emit('join', { nick: SELF, channel: CH });
  client.emit('userlist', names(opts.occupants ?? [{ nick: SELF, modes: ['q'] }]));
  await tick();
  client.emit('notice', chanServ('Channel is already registered'));
  await tick();
  client.emit('inviteList', {
    channel: CH,
    invites: (opts.invites ?? []).map((invited) => ({ channel: CH, invited })),
  });
}

test('apply: joins, registers, secures, replaces +I and kicks non-members, then becomes sendable', async () => {
  const { client, acl } = setup();
  const result = acl.apply(CH, ['alice', 'bob']);
  await answerHappyPath(client, {
    occupants: [{ nick: SELF, modes: ['q', 'o'] }, { nick: 'alice' }, { nick: 'mallory' }],
    invites: ['alice!*@*', 'carol!*@*'],
  });

  assert.deepEqual(await result, { ok: true });
  assert.deepEqual(client.rawCalls, [
    ['JOIN', CH],
    ['MODE', CH, '+inst'],
    ['MODE', CH, '+I'],
    ['MODE', CH, '+I', 'bob!*@*'],
    ['MODE', CH, '-I', 'carol!*@*'],
    ['KICK', CH, 'mallory', 'No longer a member of this community'],
  ]);
  assert.deepEqual(client.sayCalls, [{ target: 'ChanServ', message: `REGISTER ${CH}` }]);
  assert.ok(acl.isSendable(CH));
});

test('apply: a second projection re-reads NAMES instead of re-joining', async () => {
  const { client, acl } = setup();
  const first = acl.apply(CH, ['alice']);
  await answerHappyPath(client);
  await first;

  client.rawCalls = [];
  const second = acl.apply(CH, []);
  await tick();
  assert.deepEqual(client.rawCalls[0], ['NAMES', CH]);
  client.emit('userlist', names([{ nick: SELF, modes: ['q'] }, { nick: 'alice' }]));
  await tick();
  client.emit('notice', chanServ('Channel is already registered'));
  await tick();
  client.emit('inviteList', { channel: CH, invites: [{ invited: 'alice!*@*' }] });

  assert.deepEqual(await second, { ok: true });
  assert.ok(client.rawCalls.some((l) => l.join(' ') === `MODE ${CH} -I alice!*@*`));
  assert.ok(client.rawCalls.some((l) => l[0] === 'KICK' && l[2] === 'alice'));
});

test('apply: a squatted channel is recovered with PURGE ADD (confirmed), PURGE DEL, then a rejoin as op', async () => {
  const { client, acl } = setup();
  const result = acl.apply(CH, ['alice']);

  await tick();
  client.emit('join', { nick: SELF, channel: CH });
  client.emit('userlist', names([{ nick: 'squatter', modes: ['o'] }, { nick: SELF }]));
  await tick();
  assert.deepEqual(client.sayCalls.at(-1), { target: 'ChanServ', message: `PURGE ADD ${CH}` });
  client.emit('notice', chanServ('Warning: you are about to empty this channel and remove it from the server.'));
  client.emit('notice', chanServ(`To confirm, run this command: /CS PURGE ADD ${CH} c0ffee`));
  await tick();
  // The code alone: anything after it merges into Ergo's unsplit final parameter.
  assert.equal(client.sayCalls.at(-1)?.message, `PURGE ADD ${CH} c0ffee`);
  client.emit('kick', { kicked: SELF, channel: CH });
  client.emit('notice', chanServ(`Successfully purged channel ${CH} from the server`));
  await tick();
  assert.equal(client.sayCalls.at(-1)?.message, `PURGE DEL ${CH}`);
  client.emit('notice', chanServ(`Successfully unpurged channel ${CH} from the server`));
  await tick();
  assert.deepEqual(client.rawCalls.at(-1), ['JOIN', CH], 'rejoins after the purge kicked it');
  client.emit('join', { nick: SELF, channel: CH });
  client.emit('userlist', names([{ nick: SELF, modes: ['o'] }]));
  await tick();
  client.emit('notice', chanServ(`Channel ${CH} successfully registered`));
  await tick();
  client.emit('inviteList', { channel: CH, invites: [] });

  assert.deepEqual(await result, { ok: true });
  assert.ok(acl.isSendable(CH));
});

test('apply: still no op after recovery is a no-op failure, and the channel stays unsendable', async () => {
  const { client, acl } = setup();
  const result = acl.apply(CH, []);
  await tick();
  client.emit('userlist', names([{ nick: SELF }]));
  await tick();
  client.emit('notice', chanServ(`To confirm, run this command: /CS PURGE ADD ${CH} c0ffee`));
  await tick();
  client.emit('notice', chanServ(`Successfully purged channel ${CH} from the server`));
  await tick();
  client.emit('notice', chanServ(`Successfully unpurged channel ${CH} from the server`));
  await tick();
  client.emit('userlist', names([{ nick: SELF }]));

  assert.deepEqual(await result, { ok: false, reason: 'no-op' });
  assert.ok(!acl.isSendable(CH));
});

test('apply: a refused REGISTER fails the projection', async () => {
  const { client, acl } = setup();
  const result = acl.apply(CH, []);
  await tick();
  client.emit('userlist', names([{ nick: SELF, modes: ['o'] }]));
  await tick();
  client.emit('notice', chanServ('Channel registration is restricted to server operators'));

  assert.deepEqual(await result, { ok: false, reason: 'register-refused' });
  assert.ok(!acl.isSendable(CH));
});

test('apply: refuses before touching IRC when the channel, the nicks, the connection or OPER is wrong', async () => {
  const outcomes: AclOutcome[] = [];
  const ok = setup();
  outcomes.push(await ok.acl.apply('#announce', []));
  outcomes.push(await ok.acl.apply(CH, ['bad nick']));
  outcomes.push(await ok.acl.apply(CH, Array.from({ length: 1001 }, (_, i) => `n${i}`)));
  outcomes.push(await setup({ registered: false }).acl.apply(CH, []));
  outcomes.push(await setup({ oper: false }).acl.apply(CH, []));

  assert.deepEqual(
    outcomes.map((o) => (o.ok ? 'ok' : o.reason)),
    ['invalid-channel', 'invalid-nicks', 'invalid-nicks', 'not-connected', 'not-oper']
  );
  assert.deepEqual(ok.client.rawCalls, [], 'nothing was sent for a refused request');
});

test('apply: an unanswered step times out instead of hanging the queue', async () => {
  const { client, acl } = setup({ stepTimeoutMs: 20 });
  assert.deepEqual(await acl.apply(CH, []), { ok: false, reason: 'timeout' });

  // The next projection still runs.
  const next = acl.apply(CH, []);
  await answerHappyPath(client);
  assert.deepEqual(await next, { ok: true });
});

test('OPER: 464 or 491 clears it, and projections refuse until it is accepted again', async () => {
  const { client, acl } = setup();
  assert.ok(acl.isOper());
  client.emit('raw', { line: `:irc.korin.pink 464 ${SELF} :Password incorrect`, from_server: true });
  assert.ok(!acl.isOper());
  assert.deepEqual(await acl.apply(CH, []), { ok: false, reason: 'not-oper' });
});

test('reset: a dropped connection fails a projection mid-flight and forgets the sendable set', async () => {
  const { client, acl } = setup();
  const first = acl.apply(CH, []);
  await answerHappyPath(client);
  await first;
  assert.ok(acl.isSendable(CH));

  const midFlight = acl.apply(CH, []);
  await tick();
  acl.reset();
  assert.deepEqual(await midFlight, { ok: false, reason: 'timeout' });
  assert.ok(!acl.isSendable(CH));
  assert.ok(!acl.isOper());
});

test('the bridge being kicked from a channel makes it unsendable', async () => {
  const { client, acl } = setup();
  const result = acl.apply(CH, []);
  await answerHappyPath(client);
  await result;

  client.emit('kick', { kicked: SELF, channel: CH });
  assert.ok(!acl.isSendable(CH));
});
