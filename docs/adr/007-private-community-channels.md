# ADR-007: Private-Community Channels — Projection, ACL and Routing

**Status:** Accepted
**Date:** 2026-10-03
**Repos:** obrien-k/korin-pink (paired with orphic-inc/stellar-api ADR-0030)
**Amends:** ADR-006 (the bridge's sendable set)

---

## Context

stellar-api ADR-0030 lets a community announce privately: its releases go to a
gated channel, `#c-<id>`, instead of public `#announce`. stellar owns membership
and korin enforces the channel. stellar's half shipped in v0.9.0:

- `POST /irc/announce` carries an optional `target: { visibility, community }`.
- A periodic job, plus a push before each private announce, sends the complete
  verified-nick set of each private community to `POST /irc/membership` as
  `{ community, nicks }`. The set is a full replacement every time, never a delta.

korin had built neither. Worse, `/irc/announce` validates with a plain
`z.object`, which **drops** `target`, so every private community's announce has
been posting to public `#announce`.

Five properties of korin shape the decision:

- **The bridge's sendable set is static.** It joins `IRC_CHANNELS` on connect and
  `deliver()` rejects anything else (ADR-006).
- **stellar's announce queue is global and holds on failure.** A non-2xx holds the
  cursor for every community, so a *permanent* failure on one private channel
  stalls all announces site-wide.
- **korin keeps no state** (ADR-003): neither the api nor the bridge has a
  datastore.
- **A nick is an account.** `force-nick-equals-account` means a `nick!*@*` mask
  identifies one account.
- **Only `chanreg` opers may register channels** (`operator-only: true`), and
  `chan-list-modes` capped every `+b/+e/+I` list at 60 entries.

---

## Decision

**A projection creates, secures and populates the channel; only a channel
secured that way can receive a line.**

1. **Join on projection.** `POST /irc/membership` for community N makes the bridge:
   - register `#c-N` through ChanServ if needed, with the bridge's account as founder;
   - join it;
   - verify it holds op;
   - set `+i +s +n +t`;
   - replace the ACL.

   Only then does `#c-N` join the sendable set, which becomes `IRC_CHANNELS` plus
   the projected channels. The set is held in memory and rebuilt by the next
   projection after a restart.
2. **The ACL is a replaced `+I` list.** The bridge reads the channel's current
   invite-exception list and occupants, then:
   - adds `nick!*@*` for each projected nick that lacks one;
   - removes every other mask;
   - kicks occupants who aren't in the set, with a fixed reason.

   `nicks: []` clears the list and empties the channel of members. The bridge
   itself is never kicked.
3. **The api validates, and the bridge acts.**
   - The api's `POST /irc/membership` (`x-pull-key`) validates
     `{ community: positive int, nicks: string[] }`, dedupes the nicks, and derives
     `#c-<community>`.
   - It forwards to the bridge's `PUT /channels/:channel/acl` (`x-bridge-secret`),
     which accepts only `#c-<digits>`.
   - It answers `204` once the bridge has applied the set, and `503` if the bridge
     couldn't.
4. **Nicks are checked against the nick grammar at both layers.** One bad nick
   fails the whole set with `400`. A set larger than 1,000 is also a `400`, never
   cut short.
5. **Routing on `/irc/announce`:**

   | `target` | Delivered to |
   |---|---|
   | absent, or `visibility: 'PUBLIC'` | `#announce`, as before |
   | `visibility: 'PRIVATE'` | `#c-<community>` only, never `#announce` |
   | `PRIVATE`, channel not in the sendable set | nowhere: `503` |
   | `PRIVATE` without `community`, an unknown `visibility`, or a non-empty `channel` | nowhere: `400` |

6. **The bridge opers up and registers its channels.**
   - A new secret, `IRC_OPER_PASS`, opers the bridge up on connect.
   - The `bot` oper class gains `chanreg` and `nofakelag`, and nothing broader.
   - `limits.chan-list-modes` rises from 60 to 1,000, matching the projection cap.
7. **A community that turns PUBLIC again keeps its channel.** stellar stops
   projecting it, nothing routes there any more, and the channel stays frozen with
   its last ACL. That's intended behaviour, not a leak.

---

## Rationale

- **Joining on projection makes a not-joined channel transient.**
  - stellar projects before every private announce, so the channel is normally
    ready before the line arrives.
  - After a korin restart, or a failed projection, the `503` holds stellar's cursor
    only until the next projection: at most one tick, sooner with the push before
    each announce.
  - A static list could never self-heal: every new private community would need a
    redeploy, and would stall the queue until then.
- **The channel is never open, even briefly.** It enters the sendable set only
  after `+i` and the ACL are in place.
- **Registration is a security boundary, not housekeeping.**
  - An unregistered `#c-N` can be squatted by anyone who guesses the name: they
    join first, hold op, and the bridge can't set modes.
  - Every private announce would then `503`, stalling all communities' announces.
  - Registration makes the bridge the founder, has ChanServ op it on join, and
    persists modes and `+I` across Ergo restarts. Requiring op before a channel
    becomes sendable covers whatever registration doesn't.
- **Kicking keeps the channel matching the set.** `+i` only gates future joins. A
  member stellar has removed would otherwise keep reading, possibly for days
  under `always-on`.
- **Nicks are injection surface.** Each one becomes text in a raw `MODE` or `KICK`
  line sent by an opered bot. A space, comma, `!`, `@`, `*`, `:` or CR/LF could add
  modes or whole commands, so validation is an allowlist at both layers.
- **Private never falls back to public.** Answering `503` delays a line; falling
  back to `#announce` would leak it. The `400` cases are shapes stellar never sends,
  and rejecting `channel` keeps it from becoming a redirect.
- **No korin state.** The ACL is a disposable view, reconstructed by the next
  projection after any restart, as ADR-003 requires.

---

## Consequences

- **ADR-006 is amended.**
  - The sendable set is `IRC_CHANNELS` plus the projected `#c-<digits>` channels.
  - Its "a not-joined channel is a permanent misconfiguration" clause now covers
    only `IRC_CHANNELS`. For `#c-N`, not-joined means "not projected yet", which is
    transient, and the bridge answers `503` for it, not `400`.
- **New operational surface:**
  - `IRC_OPER_PASS` must be set in the bridge's environment and in the deploy
    secrets.
  - Without it, projections fail with `503`, private announces stall the queue
    until it's set, and public announces are unaffected.
- **The `bot` oper class is wider:** `chanreg` and `nofakelag`. Its capabilities
  are still pinned by `oper-policy.test.ts`.
- **Lists can be larger.** Any channel op may now keep up to 1,000 bans,
  exceptions or invite exceptions. On a small network that costs only memory.
- **Shipping order:**
  - The membership half must ship **before** routing honours `target`. Otherwise
    every private announce `503`s for want of a channel, and the shared cursor
    stalls.
  - Until routing ships, private announces keep leaking to `#announce`, which is
    no worse than today.
- **Leftover channels.** A community that turns PUBLIC again, or is deleted,
  leaves `#c-N` registered and quiet. Removing it is a manual SysOp task, if anyone
  ever wants it.
