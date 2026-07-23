import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBridge, type BridgeConfig, type IrcClient } from '../src/bridge.js';

// ---------------------------------------------------------------------------
// Test doubles — a fake IRC client we can drive synthetic events through, a
// recording fetch that serves stellar-id lookups and captures the metrics POST,
// and a controllable clock so presence accounting is deterministic.
// ---------------------------------------------------------------------------

class FakeClient implements IrcClient {
  handlers = new Map<string, Array<(event: any) => void>>();
  connectCalls = 0;
  whoCalls: string[] = [];
  rawCalls: string[][] = [];
  sayCalls: Array<{ target: string; message: string }> = [];
  quitCalls: Array<string | undefined> = [];

  on(event: string, handler: (event: any) => void): unknown {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }
  connect(): void {
    this.connectCalls++;
  }
  who(target: string): void {
    this.whoCalls.push(target);
  }
  raw(...args: string[]): void {
    this.rawCalls.push(args);
  }
  say(target: string, message: string): void {
    this.sayCalls.push({ target, message });
  }
  quit(message?: string): void {
    this.quitCalls.push(message);
  }

  /** Drive an IRC event into every registered handler. */
  emit(event: string, payload?: unknown): void {
    for (const h of this.handlers.get(event) ?? []) h(payload);
  }
}

interface UserMetricsRow {
  nick: string;
  stellarId?: string;
  presenceSeconds: number;
  messageCount: number;
  channelCount: number;
  channels: string[];
  channelMessages: Record<string, number>;
  windowStart: number;
  windowEnd: number;
}

interface InteractionRow {
  from: string;
  to: string;
  mentionCount: number;
}

// A recording fetch: GET /irc/users/:nick/stellar-id resolves from `stellarMap`
// (string = linked, null = unlinked, absent = throw → unresolved), and POST
// /irc/metrics captures the flushed body. Records every call for assertions.
function makeFetch(stellarMap: Record<string, string | null>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const metricsPosts: UserMetricsRow[][] = [];
  const interactionPosts: InteractionRow[][] = [];

  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });

    if (init?.method === 'POST' && u.endsWith('/irc/metrics')) {
      const body = JSON.parse(String(init.body)) as {
        users: UserMetricsRow[];
        interactions: InteractionRow[];
      };
      metricsPosts.push(body.users);
      interactionPosts.push(body.interactions);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const m = u.match(/\/irc\/users\/([^/]+)\/stellar-id$/);
    if (m) {
      const nick = decodeURIComponent(m[1]);
      if (!(nick in stellarMap)) return new Response('boom', { status: 502 });
      return new Response(JSON.stringify({ nick, stellarId: stellarMap[nick] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  return { fetchImpl, calls, metricsPosts, interactionPosts };
}

// setImmediate fires after the microtask queue drains, so awaiting it lets the
// fire-and-forget resolveStellarId() chains settle before we flush/assert.
const settle = () => new Promise((r) => setImmediate(r));

function baseConfig(over: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    host: 'irc.test',
    port: 6667,
    tls: false,
    nick: 'stellar-bridge',
    saslUser: 'stellar-bridge',
    saslPass: 'secret',
    korinApiUrl: 'http://korin.test',
    bridgeSecret: 'bridge-secret',
    flushIntervalMs: 1_000_000_000, // never auto-fires during a test
    channels: ['#announce', '#stellar', '#korin'],
    ...over,
  };
}

// ---------------------------------------------------------------------------

test('flush payload: a linked and an unlinked user both flush sane raw signals', async () => {
  const client = new FakeClient();
  const { fetchImpl, calls, metricsPosts, interactionPosts } = makeFetch({ Alice: '42', Bob: null });
  let clock = 1_000_000;
  const bridge = createBridge(baseConfig(), { client, fetchImpl, now: () => clock });

  try {
    bridge.start();
    client.emit('join', { nick: 'Alice', channel: '#stellar' });
    client.emit('join', { nick: 'Bob', channel: '#korin' });
    client.emit('privmsg', { nick: 'Alice', target: '#stellar', message: 'hi' });
    client.emit('privmsg', { nick: 'Alice', target: '#stellar', message: 'again' });
    client.emit('privmsg', { nick: 'Bob', target: '#korin', message: 'yo' });

    await settle(); // let stellar-id resolution settle before flushing
    clock += 5_000; // five seconds of presence
    await bridge.flush();

    const rows = metricsPosts.at(-1)!;
    const alice = rows.find((r) => r.nick === 'Alice')!;
    const bob = rows.find((r) => r.nick === 'Bob')!;

    assert.equal(alice.stellarId, '42');
    assert.equal(alice.presenceSeconds, 5);
    assert.equal(alice.messageCount, 2);
    assert.equal(alice.channelCount, 1);
    assert.deepEqual(alice.channels, ['#stellar']);
    assert.deepEqual(alice.channelMessages, { '#stellar': 2 });
    assert.equal(alice.windowEnd - alice.windowStart, 5_000);

    // Unlinked nick: a definitive miss → stellarId absent, still flushes raw activity.
    assert.equal(bob.stellarId, undefined);
    assert.equal(bob.messageCount, 1);
    assert.deepEqual(bob.channels, ['#korin']);
    assert.deepEqual(bob.channelMessages, { '#korin': 1 });

    // No one mentioned anyone, so the interactions list is present but empty.
    assert.deepEqual(interactionPosts.at(-1), []);

    // The stellar-id lookup carried the bridge secret (story 10).
    const lookup = calls.find((c) => c.url.endsWith('/irc/users/Alice/stellar-id'))!;
    assert.equal((lookup.init?.headers as Record<string, string>)['x-bridge-secret'], 'bridge-secret');
  } finally {
    await bridge.stop();
  }
});

test('channelMessages: a per-channel breakdown that sums to the channel-message total', async () => {
  const client = new FakeClient();
  const { fetchImpl, metricsPosts } = makeFetch({ Alice: null });
  let clock = 1_000;
  const bridge = createBridge(baseConfig(), { client, fetchImpl, now: () => clock });
  try {
    bridge.start();
    client.emit('join', { nick: 'Alice', channel: '#music' });
    client.emit('privmsg', { nick: 'Alice', target: '#music', message: 'one' });
    client.emit('privmsg', { nick: 'Alice', target: '#music', message: 'two' });
    client.emit('privmsg', { nick: 'Alice', target: '#korin', message: 'three' });
    // A private query to another user is counted in the total but not in any channel.
    client.emit('privmsg', { nick: 'Alice', target: 'Carol', message: 'psst' });
    await settle();
    clock += 1_000;
    await bridge.flush();

    const alice = metricsPosts.at(-1)!.find((r) => r.nick === 'Alice')!;
    assert.equal(alice.messageCount, 4); // total includes the private one
    assert.deepEqual(alice.channelMessages, { '#music': 2, '#korin': 1 });
    // Channel buckets sum to the channel-targeted subset, never the private msg.
    const channelTotal = Object.values(alice.channelMessages).reduce((a, b) => a + b, 0);
    assert.equal(channelTotal, 3);
  } finally {
    await bridge.stop();
  }
});

test('interactions: directional mention pairs among tracked nicks, carried across a rename', async () => {
  const client = new FakeClient();
  const { fetchImpl, metricsPosts, interactionPosts } = makeFetch({ Alice: null, Bob: null });
  let clock = 1_000;
  const bridge = createBridge(baseConfig(), { client, fetchImpl, now: () => clock });
  try {
    bridge.start();
    client.emit('join', { nick: 'Alice', channel: '#stellar' });
    client.emit('join', { nick: 'Bob', channel: '#stellar' });
    await settle();

    // Alice mentions Bob (tracked → counted), an untracked Zed (ignored), and
    // herself (never a self-pair). Bob never mentions Alice → the pair is one-sided.
    client.emit('privmsg', { nick: 'Alice', target: '#stellar', message: 'Bob: and zed, alice out' });
    client.emit('privmsg', { nick: 'Alice', target: '#stellar', message: 'still here Bob' });
    client.emit('privmsg', { nick: 'Bob', target: '#stellar', message: 'noted' });

    // Bob renames; Alice's two Bob-mentions must follow him to the new nick.
    client.emit('nick', { nick: 'Bob', new_nick: 'Bobby' });
    await settle();
    clock += 1_000;
    await bridge.flush();

    const interactions = interactionPosts.at(-1)!;
    assert.equal(interactions.length, 1, 'exactly one directional pair');
    assert.deepEqual(interactions[0], { from: 'Alice', to: 'Bobby', mentionCount: 2 });

    // Sanity: the rename also carried Bob's own activity to Bobby.
    assert.ok(metricsPosts.at(-1)!.some((r) => r.nick === 'Bobby'));
    assert.ok(!metricsPosts.at(-1)!.some((r) => r.nick === 'Bob'));
  } finally {
    await bridge.stop();
  }
});

test('registered: seeds membership via who() and joins the configured channels', async () => {
  const client = new FakeClient();
  const { fetchImpl } = makeFetch({});
  const bridge = createBridge(baseConfig({ channels: ['#stellar', '#korin'] }), {
    client,
    fetchImpl,
    now: () => 1,
  });
  try {
    bridge.start();
    client.emit('registered');
    assert.deepEqual(client.whoCalls, ['*']); // tokened WHOX, not bare WHO %nuha
    const joins = client.rawCalls.filter((a) => a[0] === 'JOIN').map((a) => a[1]);
    assert.deepEqual(joins, ['#stellar', '#korin']);
  } finally {
    await bridge.stop();
  }
});

test('wholist: seeds real channels only — tolerates a missing or "*" placeholder', async () => {
  const client = new FakeClient();
  const { fetchImpl, metricsPosts } = makeFetch({ Carol: null, Dave: null, Eve: null });
  let clock = 500;
  const bridge = createBridge(baseConfig(), { client, fetchImpl, now: () => clock });
  try {
    bridge.start();
    client.emit('wholist', {
      users: [
        { nick: 'Carol', channel: '#stellar' }, // real channel → seeded
        { nick: 'Dave' }, // thin reply, no channel → online, no channel
        { nick: 'Eve', channel: '*' }, // global-WHO placeholder → must NOT be seeded
      ],
    });
    await settle();
    clock += 1_000;
    await bridge.flush();

    const rows = metricsPosts.at(-1)!;
    const carol = rows.find((r) => r.nick === 'Carol')!;
    const dave = rows.find((r) => r.nick === 'Dave')!;
    const eve = rows.find((r) => r.nick === 'Eve')!;
    assert.deepEqual(carol.channels, ['#stellar']);
    assert.equal(carol.channelCount, 1);
    // Online (counted) but no channel seeded — and crucially nothing threw.
    assert.equal(dave.channelCount, 0);
    assert.equal(dave.presenceSeconds, 1);
    assert.deepEqual(eve.channels, []); // "*" is not a real channel
    assert.equal(eve.channelCount, 0);
  } finally {
    await bridge.stop();
  }
});

test('nick change: activity carries to the new nick and the stellarId re-resolves', async () => {
  const client = new FakeClient();
  const { fetchImpl, calls, metricsPosts } = makeFetch({ OldNick: '7', NewNick: '9' });
  let clock = 2_000;
  const bridge = createBridge(baseConfig(), { client, fetchImpl, now: () => clock });
  try {
    bridge.start();
    client.emit('join', { nick: 'OldNick', channel: '#stellar' });
    client.emit('privmsg', { nick: 'OldNick', target: '#stellar', message: 'hello' });
    await settle(); // OldNick resolves to '7'

    client.emit('nick', { nick: 'OldNick', new_nick: 'NewNick' });
    await settle(); // re-resolves NewNick → '9'
    await bridge.flush();

    const rows = metricsPosts.at(-1)!;
    assert.equal(rows.length, 1);
    const u = rows[0];
    assert.equal(u.nick, 'NewNick');
    assert.equal(u.stellarId, '9'); // re-resolved under the new nick
    assert.equal(u.messageCount, 1); // accumulated activity carried over
    assert.deepEqual(u.channels, ['#stellar']);

    // The link is keyed on the nick — a fresh lookup happened for the new nick.
    assert.ok(calls.some((c) => c.url.endsWith('/irc/users/NewNick/stellar-id')));
  } finally {
    await bridge.stop();
  }
});

test('reconnect: a dropped socket schedules exactly one reconnect', async () => {
  const client = new FakeClient();
  const { fetchImpl } = makeFetch({});
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  const bridge = createBridge(baseConfig(), {
    client,
    fetchImpl,
    now: () => 1,
    scheduleReconnect: (fn, ms) => scheduled.push({ fn, ms }),
  });
  try {
    bridge.start();
    const connectsAfterStart = client.connectCalls;

    client.emit('socket close');
    assert.equal(scheduled.length, 1); // one reconnect scheduled

    // A second close while the first is still pending must NOT double-schedule.
    client.emit('socket close');
    assert.equal(scheduled.length, 1);

    // Fire the pending reconnect → exactly one new connect, guard clears.
    scheduled[0].fn();
    assert.equal(client.connectCalls, connectsAfterStart + 1);

    // A later drop schedules again (the guard is per-disconnect, not permanent).
    client.emit('socket close');
    assert.equal(scheduled.length, 2);
  } finally {
    await bridge.stop();
  }
});

test('no import/construction side effects: createBridge opens nothing until start()', async () => {
  const client = new FakeClient();
  const { fetchImpl } = makeFetch({});
  createBridge(baseConfig(), { client, fetchImpl });
  // Constructing the bridge must not connect, WHO, or send anything.
  assert.equal(client.connectCalls, 0);
  assert.equal(client.whoCalls.length, 0);
  assert.equal(client.rawCalls.length, 0);
});

// ---------------------------------------------------------------------------
// deliver() — the announce delivery rules (ADR-006)
// ---------------------------------------------------------------------------

function startedBridge(over: Partial<BridgeConfig> = {}) {
  const client = new FakeClient();
  const { fetchImpl } = makeFetch({});
  const bridge = createBridge(baseConfig(over), { client, fetchImpl, scheduleReconnect: () => {} });
  bridge.start();
  return { client, bridge };
}

test('deliver: says to a joined channel once registered', async () => {
  const { client, bridge } = startedBridge();
  client.emit('registered');

  assert.deepEqual(bridge.deliver('#announce', 'hello'), { ok: true });
  assert.deepEqual(client.sayCalls, [{ target: '#announce', message: 'hello' }]);

  await bridge.stop();
});

test('deliver: refuses a channel the bridge has not joined', async () => {
  const { client, bridge } = startedBridge();
  client.emit('registered');

  // A nick is a valid say() target too — refusing unjoined targets is what keeps
  // an opered bot from being turned into an arbitrary-message relay.
  assert.deepEqual(bridge.deliver('#not-joined', 'x'), { ok: false, reason: 'not-joined' });
  assert.deepEqual(bridge.deliver('somenick', 'x'), { ok: false, reason: 'not-joined' });
  assert.equal(client.sayCalls.length, 0);

  await bridge.stop();
});

test('deliver: refuses before registration and again after the socket drops', async () => {
  const { client, bridge } = startedBridge();

  // start() has run but no 'registered' yet — the process is up, IRC is not.
  assert.deepEqual(bridge.deliver('#announce', 'x'), { ok: false, reason: 'not-connected' });

  client.emit('registered');
  assert.deepEqual(bridge.deliver('#announce', 'x'), { ok: true });

  client.emit('socket close');
  assert.deepEqual(bridge.deliver('#announce', 'x'), { ok: false, reason: 'not-connected' });
  assert.equal(client.sayCalls.length, 1, 'only the registered-window call was said');

  await bridge.stop();
});
