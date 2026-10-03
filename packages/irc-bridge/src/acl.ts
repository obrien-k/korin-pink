/**
 * acl.ts — applying a membership projection to a private-community channel
 * (ADR-007).
 *
 * One projection is a short conversation with Ergo: join `#c-N`, make sure the
 * bridge holds op (recovering a squatted channel with ChanServ PURGE if not),
 * register it, secure it, read its `+I` list, then replace that list and kick
 * whoever the set no longer includes. Only a channel that has been through all of
 * that becomes sendable.
 *
 * Replies arrive as irc-framework events, so each step waits for its event with a
 * timeout, and projections run one at a time: two interleaved conversations could
 * otherwise read each other's ChanServ notices.
 */

import type { IrcClient } from './bridge.js';
import {
  casefold,
  dedupeNicks,
  isPrivateChannel,
  isValidNick,
  MAX_ACL_NICKS,
  modeLines,
  parsePurgeCode,
  planAcl,
} from './channels.js';

/** Why a projection was not applied. Only the first two are the caller's fault. */
export type AclFailure =
  | 'invalid-channel'
  | 'invalid-nicks'
  | 'not-connected'
  | 'not-oper'
  | 'no-op'
  | 'register-refused'
  | 'timeout';

export type AclOutcome = { ok: true } | { ok: false; reason: AclFailure };

export interface AclDeps {
  client: IrcClient;
  /** The bridge's own nick: never kicked, and the one whose op status counts. */
  selfNick: string;
  /** Whether the bridge is on IRC right now. */
  isRegistered(): boolean;
  /** Per-step wait for Ergo's reply. Defaults to 10s. */
  stepTimeoutMs?: number;
}

export interface AclManager {
  /** Install the reply listeners; called once, from the bridge's wireHandlers. */
  wire(): void;
  /** Apply one projection. Never throws; failures come back as a reason. */
  apply(channel: string, nicks: string[]): Promise<AclOutcome>;
  /** Whether a private channel has been projected since the bridge connected. */
  isSendable(channel: string): boolean;
  /** Whether the bridge's OPER has been accepted on this connection. */
  isOper(): boolean;
  /** Forget everything tied to the connection: called when the socket drops. */
  reset(): void;
}

class StepTimeout extends Error {}
class StepFailed extends Error {
  constructor(public readonly reason: AclFailure) {
    super(reason);
  }
}

interface Waiter {
  event: string;
  match(payload: any): boolean;
  resolve(payload: any): void;
  reject(err: Error): void;
}

/** Ergo's PREFIX modes at op level or above: founder, admin, op. */
const OP_MODES = new Set(['q', 'a', 'o']);
const KICK_REASON = 'No longer a member of this community';

export function createAclManager(deps: AclDeps): AclManager {
  const { client } = deps;
  const stepTimeoutMs = deps.stepTimeoutMs ?? 10_000;
  const self = casefold(deps.selfNick);

  const waiters = new Set<Waiter>();
  const joined = new Set<string>();
  const sendable = new Set<string>();
  let oper = false;
  let queue: Promise<unknown> = Promise.resolve();

  function dispatch(event: string, payload: any): void {
    for (const w of [...waiters]) {
      if (w.event === event && w.match(payload)) {
        waiters.delete(w);
        w.resolve(payload);
      }
    }
  }

  /** Register a waiter BEFORE sending the command it waits on. */
  function waitFor<T>(event: string, match: (p: any) => boolean): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const waiter: Waiter = { event, match, resolve, reject };
      waiters.add(waiter);
      setTimeout(() => {
        if (waiters.delete(waiter)) reject(new StepTimeout(event));
      }, stepTimeoutMs);
    });
  }

  const isChanServ = (p: { nick?: string }) => casefold(p.nick ?? '') === 'chanserv';
  const sameChannel = (a: string | undefined, b: string) => casefold(a ?? '') === casefold(b);

  function chanServ(command: string): void {
    client.say('ChanServ', command);
  }

  /** JOIN (or re-NAMES) the channel and return its occupants with their modes. */
  async function namesOf(channel: string): Promise<Array<{ nick: string; modes: string[] }>> {
    const names = waitFor<{ users: Array<{ nick: string; modes?: string[] }> }>(
      'userlist',
      (p) => sameChannel(p.channel, channel)
    );
    if (joined.has(casefold(channel))) client.raw('NAMES', channel);
    else client.raw('JOIN', channel);
    const { users } = await names;
    return users.map((u) => ({ nick: u.nick, modes: u.modes ?? [] }));
  }

  function holdsOp(users: Array<{ nick: string; modes: string[] }>): boolean {
    const me = users.find((u) => casefold(u.nick) === self);
    return !!me && me.modes.some((m) => OP_MODES.has(m));
  }

  /** ChanServ PURGE ADD (with its confirmation code), then PURGE DEL. */
  async function recoverSquat(channel: string): Promise<void> {
    console.warn(`[bridge] ${channel} is held by another op — recovering with ChanServ PURGE`);
    const prompt = waitFor<{ message: string }>(
      'notice',
      (p) => isChanServ(p) && parsePurgeCode(p.message, channel) !== null
    );
    chanServ(`PURGE ADD ${channel}`);
    const code = parsePurgeCode((await prompt).message, channel)!;

    const purged = waitFor('notice', (p) => isChanServ(p) && /successfully purged/i.test(p.message));
    chanServ(`PURGE ADD ${channel} ${code} ADR-007 squat recovery`);
    await purged;
    joined.delete(casefold(channel)); // the purge kicked the bridge too

    const unpurged = waitFor(
      'notice',
      (p) => isChanServ(p) && /unpurged|wasn't previously purged/i.test(p.message)
    );
    chanServ(`PURGE DEL ${channel}`);
    await unpurged;
  }

  /** Ergo's replies to REGISTER (irc/chanserv.go, irc/errors.go, v2.18). */
  const REGISTER_REPLY =
    /successfully registered|already registered|must be an oper|no such channel|restricted to server operators/i;

  async function register(channel: string): Promise<void> {
    const reply = waitFor<{ message: string }>(
      'notice',
      (p) => isChanServ(p) && REGISTER_REPLY.test(p.message ?? '')
    );
    chanServ(`REGISTER ${channel}`);
    const { message } = await reply;
    if (!/successfully registered|already registered/i.test(message)) {
      throw new StepFailed('register-refused');
    }
  }

  async function inviteList(channel: string): Promise<string[]> {
    const list = waitFor<{ invites: Array<{ invited: string }> }>('inviteList', (p) =>
      sameChannel(p.channel, channel)
    );
    client.raw('MODE', channel, '+I');
    return (await list).invites.map((i) => i.invited);
  }

  async function run(channel: string, nicks: string[]): Promise<AclOutcome> {
    if (!deps.isRegistered()) return { ok: false, reason: 'not-connected' };
    if (!oper) return { ok: false, reason: 'not-oper' };

    let users = await namesOf(channel);
    if (!holdsOp(users)) {
      await recoverSquat(channel);
      users = await namesOf(channel);
      if (!holdsOp(users)) return { ok: false, reason: 'no-op' };
    }

    await register(channel);
    client.raw('MODE', channel, '+inst');

    const plan = planAcl({
      nicks,
      currentMasks: await inviteList(channel),
      occupants: users.map((u) => u.nick),
      self: deps.selfNick,
    });
    for (const line of modeLines(channel, '+', 'I', plan.add)) client.raw(...line);
    for (const line of modeLines(channel, '-', 'I', plan.remove)) client.raw(...line);
    for (const nick of plan.kick) client.raw('KICK', channel, nick, KICK_REASON);

    sendable.add(casefold(channel));
    return { ok: true };
  }

  function apply(channel: string, nicks: string[]): Promise<AclOutcome> {
    if (!isPrivateChannel(channel)) return Promise.resolve({ ok: false, reason: 'invalid-channel' });
    if (nicks.length > MAX_ACL_NICKS || !nicks.every(isValidNick)) {
      return Promise.resolve({ ok: false, reason: 'invalid-nicks' });
    }
    const unique = dedupeNicks(nicks);

    const result = queue.then(async (): Promise<AclOutcome> => {
      try {
        return await run(channel, unique);
      } catch (err: unknown) {
        if (err instanceof StepFailed) return { ok: false, reason: err.reason };
        if (err instanceof StepTimeout) {
          console.error(`[bridge] ${channel} projection timed out waiting for ${err.message}`);
          return { ok: false, reason: 'timeout' };
        }
        throw err;
      }
    });
    queue = result.catch(() => undefined);
    return result;
  }

  function wire(): void {
    for (const event of ['userlist', 'inviteList', 'notice']) {
      client.on(event, (payload: unknown) => dispatch(event, payload));
    }
    client.on('join', (e: { nick: string; channel: string }) => {
      if (casefold(e.nick) === self) joined.add(casefold(e.channel));
    });
    client.on('part', (e: { nick: string; channel: string }) => {
      if (casefold(e.nick) === self) {
        joined.delete(casefold(e.channel));
        sendable.delete(casefold(e.channel));
      }
    });
    client.on('kick', (e: { kicked: string; channel: string }) => {
      if (casefold(e.kicked ?? '') === self) {
        joined.delete(casefold(e.channel));
        sendable.delete(casefold(e.channel));
      }
    });
    // OPER's outcome is a bare numeric irc-framework has no handler for, so it is
    // read off the raw line: 381 accepted, 464 / 491 refused.
    client.on('raw', (e: { line: string; from_server: boolean }) => {
      if (!e.from_server) return;
      const numeric = / (\d{3}) /.exec(e.line)?.[1];
      if (numeric === '381') {
        oper = true;
        console.log('[bridge] OPER accepted');
      } else if (numeric === '464' || numeric === '491') {
        oper = false;
        console.error(`[bridge] OPER refused (${numeric}) — private-community projections will 503`);
      }
    });
  }

  function reset(): void {
    joined.clear();
    sendable.clear();
    oper = false;
    // Fail any projection mid-conversation now, rather than leaving it to time out:
    // its replies will never arrive on the new connection.
    for (const w of [...waiters]) {
      waiters.delete(w);
      w.reject(new StepTimeout(`${w.event} (connection lost)`));
    }
  }

  return {
    wire,
    apply,
    isSendable: (channel) => sendable.has(casefold(channel)),
    isOper: () => oper,
    reset,
  };
}
