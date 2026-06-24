/**
 * Pairwise nick-mention extraction (issue #42).
 *
 * A message "mentions" a nick when that nick appears as a standalone token —
 * "bob: hi", "thanks bob", "@bob", "bob!" all count; "bobby" does NOT (whole-token
 * match, never substring). Matching is case-insensitive because Ergo casemaps nicks
 * with `ascii`, and deduped per message: saying the same nick three times in one
 * line is one mention, so a pair can't inflate its count by repetition. stellar-api
 * aggregates these raw directional counts into its mutual-mention CRS vector (PRD-03);
 * the bridge only emits the raw signal.
 *
 * Only an already-tracked nick can be a mention target ("another tracked nick" in the
 * issue) — the caller passes the current roster, so a mention of someone the bridge
 * has never seen is ignored rather than inventing a phantom user.
 */

// Characters Ergo permits inside a nick (RFC1459 letters/digits/specials). Anything
// outside this set is a token boundary, so punctuation around a nick — "bob:", "@bob",
// "bob," — splits down to the bare nick before we match.
const TOKEN_RE = /[A-Za-z0-9[\]\\`_^{}|-]+/g;

/**
 * Distinct tracked nicks mentioned in `message`, in first-seen order.
 *
 * @param trackedByLower lowercased nick → canonical tracked nick (the roster index)
 * @param selfNickLower  lowercased sender nick, so a self-mention never counts
 */
export function extractMentions(
  message: string,
  trackedByLower: Map<string, string>,
  selfNickLower: string,
): string[] {
  const hits = new Set<string>();
  for (const token of message.match(TOKEN_RE) ?? []) {
    const lower = token.toLowerCase();
    if (lower === selfNickLower) continue;
    const canonical = trackedByLower.get(lower);
    if (canonical) hits.add(canonical);
  }
  return [...hits];
}
