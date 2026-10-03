/**
 * channels.ts — the pure rules behind private-community channels (ADR-007).
 *
 * No IRC client, no I/O: what a valid projected nick is, which channels a
 * projection may touch, and the diff that turns the channel's current state into
 * the projected set. acl.ts runs the IRC conversation around these.
 */

/**
 * The most nicks one projection may carry. Matches `limits.chan-list-modes` in
 * packages/irc/ergo.yaml, the size of a channel's `+I` list: a larger set could
 * not be represented, so it is refused whole rather than cut short.
 */
export const MAX_ACL_NICKS = 1000;

/** IRC modes sent per MODE line. Conservative; the bot is exempt from fakelag. */
export const MODES_PER_LINE = 4;

/** A channel a projection may manage: `#c-<community id>`, never a core channel. */
const PRIVATE_CHANNEL = /^#c-[1-9][0-9]*$/;

export function isPrivateChannel(channel: string): boolean {
  return PRIVATE_CHANNEL.test(channel);
}

/**
 * A nick that is safe to put in a raw MODE or KICK line (ADR-007).
 *
 * Each nick becomes text in a command sent by an opered bot, so this is an
 * allowlist, not a format check: printable ASCII only (Ergo runs
 * `casemapping: ascii`), at most `nicklen` (32), and none of the characters that
 * would end a parameter, start a trailing one, or widen a mask — space, comma,
 * `:`, `!`, `@`, `*`, `?`. It is deliberately looser than Ergo's own nick rules
 * in every other respect: a stricter check would refuse a real member's nick,
 * and one refused nick fails the whole projection.
 *
 * Duplicated in packages/api/src/lib/nicks.ts; the two are tested against the
 * same cases.
 */
export function isValidNick(nick: string): boolean {
  return /^[\x21-\x7e]{1,32}$/.test(nick) && !/[,:!@*?]/.test(nick);
}

/** Ergo's `ascii` casemapping: A-Z fold to a-z, nothing else changes. */
export function casefold(value: string): string {
  return value.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** The invite-exception mask that admits one account (nick = account on korin). */
export function maskFor(nick: string): string {
  return `${nick}!*@*`;
}

export interface AclPlan {
  /** Masks to add with `+I`. */
  add: string[];
  /** Masks to remove with `-I`: every current one the projection doesn't want. */
  remove: string[];
  /** Occupants to kick: in the channel, not in the set, not the bridge. */
  kick: string[];
}

/**
 * Diff the channel's current `+I` list and occupants against the projected set.
 * The ACL is replaced, never merged: a mask the projection doesn't name is
 * removed even if the bridge didn't set it.
 */
export function planAcl(input: {
  nicks: string[];
  currentMasks: string[];
  occupants: string[];
  self: string;
}): AclPlan {
  const wanted = new Map(input.nicks.map((n) => [casefold(maskFor(n)), maskFor(n)]));
  const current = new Set(input.currentMasks.map(casefold));
  const members = new Set(input.nicks.map(casefold));
  const self = casefold(input.self);

  return {
    add: [...wanted].filter(([folded]) => !current.has(folded)).map(([, mask]) => mask),
    remove: input.currentMasks.filter((m) => !wanted.has(casefold(m))),
    kick: input.occupants.filter((n) => {
      const folded = casefold(n);
      return folded !== self && !members.has(folded);
    }),
  };
}

/** `MODE <channel> +III a b c` lines, at most MODES_PER_LINE modes each. */
export function modeLines(
  channel: string,
  sign: '+' | '-',
  mode: string,
  args: string[]
): string[][] {
  const lines: string[][] = [];
  for (let i = 0; i < args.length; i += MODES_PER_LINE) {
    const chunk = args.slice(i, i + MODES_PER_LINE);
    lines.push(['MODE', channel, sign + mode.repeat(chunk.length), ...chunk]);
  }
  return lines;
}

/** Dedupe nicks by casefold, keeping the first spelling. */
export function dedupeNicks(nicks: string[]): string[] {
  const seen = new Set<string>();
  return nicks.filter((n) => {
    const folded = casefold(n);
    if (seen.has(folded)) return false;
    seen.add(folded);
    return true;
  });
}

/**
 * The confirmation code from ChanServ's PURGE ADD prompt:
 * "To confirm, run this command: /CS PURGE ADD #c-7 a1b2c3d4".
 * Only for the channel asked about, so a stray notice can't confirm another.
 */
export function parsePurgeCode(message: string, channel: string): string | null {
  const match = /\/CS PURGE ADD (\S+) (\S+)/i.exec(message);
  if (!match || casefold(match[1]) !== casefold(channel)) return null;
  return match[2];
}
