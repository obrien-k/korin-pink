# ADR-006: Announce Delivery Leg (api → irc-bridge)

**Status:** Accepted
**Date:** 2026-07-23
**Repos:** obrien-k/korin-pink

---

## Context

`POST /irc/announce` rendered a line and returned it in the HTTP response. Nothing
posted it to a channel, so the public firehose into `#announce` described in
stellar-api ADR-0013 / ADR-0030 was never wired (issue #70).

Closing that gap is not a one-line change, because the two halves live in different
processes. The announce POST lands on the `api` service; the IRC socket lives in
`irc-bridge`. Every call between them today runs bridge → api (`/irc/metrics`,
`/irc/verify`, stellar-id resolution) and the bridge has no listener at all. Both
services are stateless — `api` has no datastore, and ADR-003 deliberately declined
one for the bridge in v0.x.

Two properties of the surrounding system drive the decision:

- **stellar already owns durable retry.** `runAnnounceCycle` holds its cursor on a
  non-2xx and re-pushes that item on the next cycle, in order, never skipping. The
  retry machinery exists and is backed by the contribution table.
- **The bridge holds oper privileges** (`packages/irc/ergo.yaml`), so anything that
  can make it speak is a privileged capability, not a convenience.

---

## Decision

**The api pushes to a new `POST /say` endpoint on the bridge, and fails loud when
the line does not land.**

- Transport: `api` → bridge HTTP, `{ channel, message }`, authenticated with the
  existing `IRC_BRIDGE_SECRET` — the same secret now covers both directions of one
  boundary. The endpoint is bound to the compose network and never published.
- `/irc/announce` returns **503** when the line cannot be delivered. No bridge-side
  buffer.
- The api names the target channel; the **bridge rejects any channel it has not
  joined**.
- Delivery uses a purpose-built IRC renderer (`renderIrcAnnounce`), not
  `renderMinimalIrc`.
- Duplicate delivery is accepted.

---

## Rationale

- **Push over polling.** An outbox with ack semantics and a poll timer is strictly
  more mechanism than a direct call, and with no datastore the queue would be
  in-memory regardless. A broker would introduce exactly the stateful dependency
  ADR-003 declined.
- **Fail loud, because the retry already exists.** A 503 activates stellar's cursor
  hold. A bridge-side buffer answering 202 would be worse than nothing: it would
  advance the cursor on "accepted" and then lose the item on a bridge restart,
  downgrading durable at-least-once into silent loss.
- **Permanent failures block deliberately.** A channel the bridge has not joined is
  a misconfiguration; holding the cursor until it is fixed preserves in-order
  delivery, where skipping past it would silently lose announces.
- **Target validation is a privilege boundary.** `client.say()` accepts a nick
  target as readily as a channel, so an unvalidated target would make an opered bot
  an arbitrary-message relay.
- **A separate renderer, because the existing one is not for IRC.**
  `renderMinimalIrc` emits 24-bit ANSI colour and OSC-8 hyperlinks — terminal
  escapes — and references `artifact.link` only inside its `osc8` branch, which its
  only caller disables. Its output was never seen by anything but a JSON response,
  which is why the mismatch went unnoticed. It keeps that job unchanged.
- **Line length is flood control, not style.** irc-framework splits an over-length
  message and emits one PRIVMSG per block, so contributor-authored text is
  sanitised of control characters and truncated to fit a single message.

---

## Consequences

- The bridge listens for the first time. Its "opens nothing at import" property is
  preserved: the server is constructed and bound in the entrypoint, not at import.
- One secret now authenticates both directions. A leak compromises the same pair it
  already did, but the blast radius now includes making the bot speak in its joined
  channels.
- A line can post twice — at-least-once delivery means a `say()` that lands without
  stellar seeing the 2xx is retried five minutes later. Accepted rather than
  suppressed: the feed already carries a stable per-item id
  (`<guid isPermaLink="false">stellar-contribution-{id}</guid>`), which
  `parsePlatformFeed` discards, so dedupe is available korin-side alone whenever the
  duplicate rate justifies the state. It does not today.
- A bridge that is down blocks the announce queue rather than draining it. Intended,
  and visible in stellar's logs.
- stellar requires no change; the `/irc/announce` request and response shapes are
  unchanged.
- #67 (`#c-<id>` routing) extends the joined set and reuses `POST /say` rather than
  re-cutting the signature.
