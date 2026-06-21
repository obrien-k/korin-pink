# ADR-003: irc-bridge State Model

**Status:** Accepted
**Date:** 2026-06-14
**Repos:** obrien-k/korin-pink

---

## Context

The irc-bridge accumulates per-nick activity (presence, message counts, channels)
between flushes to `POST /irc/metrics`. We need to decide whether that in-flight
window is persisted or held in memory, and what the failure mode is on a bridge
crash. Ergo itself has no REST API in stable releases, so the bridge is the only
component holding this state (see ADR-001).

---

## Decision

**Hold bridge state in memory only; the bridge is stateless between restarts.**

A flush window is at most `FLUSH_INTERVAL_MS` of accumulated counters. On crash or
restart, the unflushed window is lost and a fresh window begins. No persistent
store (disk, Redis, DB) is introduced for v0.x.

---

## Rationale

- **Flush windows are short.** A lost window is bounded data loss, not corruption;
  the next window self-heals.
- **Minimalism.** Avoids a stateful dependency (Redis/DB) for the bridge purely to
  protect a single short window of soft metrics.
- **Metrics are soft signals.** stellar-api consumes IRCScore as one input among
  many; momentary gaps do not invalidate the score.

---

## Consequences

- A bridge crash loses the current (≤ one flush interval) window. Accepted for v0.x.
- Revisit if/when metrics become load-bearing enough that gaps matter, or if flush
  intervals grow long. Tracked as a candidate for a superseding ADR.
