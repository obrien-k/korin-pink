/**
 * nicks.ts — the projected-nick rule at the api boundary (ADR-007).
 *
 * Duplicated from packages/irc-bridge/src/channels.ts, which re-checks every nick
 * before it becomes text in a raw MODE or KICK line. Both packages test the same
 * cases (test/nicks.test.ts here, test/channels.test.ts there): the two must
 * agree, or the api would accept a set the bridge then refuses.
 */

/** The most nicks one projection may carry: `limits.chan-list-modes` in ergo.yaml. */
export const MAX_ACL_NICKS = 1000;

/**
 * Printable ASCII (Ergo runs `casemapping: ascii`), at most `nicklen` (32), and
 * none of the characters that would end a parameter, start a trailing one, or
 * widen a mask — space, comma, `:`, `!`, `@`, `*`, `?`. Looser than Ergo's own
 * rules otherwise: a stricter check would refuse a real member's nick, and one
 * refused nick fails the whole projection.
 */
export function isValidNick(nick: string): boolean {
  return /^[\x21-\x7e]{1,32}$/.test(nick) && !/[,:!@*?]/.test(nick);
}

/** Dedupe by Ergo's `ascii` casefold, keeping the first spelling. */
export function dedupeNicks(nicks: string[]): string[] {
  const seen = new Set<string>();
  return nicks.filter((n) => {
    const folded = n.replace(/[A-Z]/g, (c) => c.toLowerCase());
    if (seen.has(folded)) return false;
    seen.add(folded);
    return true;
  });
}

/** The private channel a community's announces and members live in (ADR-0030). */
export function communityChannel(community: number): string {
  return `#c-${community}`;
}
