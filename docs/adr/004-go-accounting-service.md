# ADR-004: Go Accounting Service (`ledger`)

**Status:** Proposed
**Date:** 2026-06-17
**Repos:** obrien-k/korin-pink (impl) · orphic-inc/stellar-api (consumer)

**Related (cross-repo):**

- stellar-api → [`docs/adr/0013-korin-pink-irc-integration.md`](https://github.com/orphic-inc/stellar-api/blob/main/docs/adr/0013-korin-pink-irc-integration.md) — the existing korin↔stellar boundary this extends.
- stellar-api → [`docs/adr/0011-delegated-irc-authentication.md`](https://github.com/orphic-inc/stellar-api/blob/main/docs/adr/0011-delegated-irc-authentication.md)
- this repo → `docs/adr/001-ergo-irc-daemon.md` (Go in the stack), `docs/adr/003-irc-bridge-state.md` (hot-state loss model).

---

## Context

Stellar orchestrates **collaborative creative works** — albums, films,
documentaries, eBooks, audiobooks, applications. A **Release behaves like a
commit**: a small building block that can serve as a stem other Contributions
build on, accreting multiple contributors. Communities differ by niche, but a
common spine binds them — the type-agnostic `Contribution` (stellar CONTEXT.md:
"Release is the primary Contribution type; Film/eLearning/ApiPlugin follow").

stellar-api is the system of record (Postgres/Prisma). korin.pink is its
performance sidecar: today it holds IRC presence/message state in memory and
flushes summaries to stellar over a shared secret
([stellar-api ADR-0013](https://github.com/orphic-inc/stellar-api/blob/main/docs/adr/0013-korin-pink-irc-integration.md)),
feeding **IRCScore**.

The capability korin lacks is a **hot-path accounting authority** — real-time
consumption accounting, ratio gating (`canConsume`), **consumption** records, and
live activity stats. Doing this per-request against Postgres in stellar-api is the
wrong place for hot, high-churn counters; a sidecar holding the working set in
memory and flushing summaries is the right shape — exactly the role korin already
plays for IRC metrics.

Each Contribution is a hosted Download URL, consumed through a session-authed
grant, and its availability is continuously health-checked (`linkHealth.ts` →
`LinkHealthStatus` PASS/WARN/FAIL); a Contribution is **Effectively Available**
while its `linkStatus ≠ FAIL`. Accounting is therefore driven by **consumption /
grant events** against that link-health substrate, with the aim of accurate,
real-time consumption accounting and ratio relief.

---

## Decision

**Build the accounting authority as a Go service, `ledger`, as a new monorepo
package (`packages/ledger/`)** — mirroring how `packages/irc` (Ergo, also Go) is
already built and deployed.

1. **Language: Go.** Ergo (`docs/adr/001-ergo-irc-daemon.md`) makes Go a
   first-class citizen here. The hot path is a natural fit: a goroutine-per-request
   HTTP server (`net/http`), a buffered channel feeding a single **batched-flush**
   goroutine, a `time.Ticker` scheduler for flush/reap, `sync/atomic` stat
   counters, and a sharded in-memory working set (`contribution_list`) under
   `sync.RWMutex`.
2. **HTTP: `net/http` standard library** — internal service, small surface, no
   framework or third-party deps.
3. **Pattern, reused:** in-memory authoritative working set + channel-fed batched
   flush to stellar + ticker scheduler + the **existing** shared-secret
   back-channel
   ([stellar-api ADR-0013](https://github.com/orphic-inc/stellar-api/blob/main/docs/adr/0013-korin-pink-irc-integration.md)).
   This *extends* that boundary; it does not replace it.
4. **Placement: monorepo package.** `packages/ledger/` with its own `go.mod`, a
   multi-stage `Dockerfile`, and a compose service on the `korin` network.
   Internal-only at first (a `/healthz`; no public Caddy route until the
   consumption-event contract lands).
5. **Domain nomenclature.** The service speaks the platform's domain language end
   to end: `contribution_list`, **consumption**, the **Ratio Mechanism** gate
   (`canConsume`), **Effective Availability** / `linkStatus`, **AnnounceKey**,
   **Freepass** / **Neutralpass**.
6. **Stellar stays the system of record.** `ledger` holds only **recoverable** hot
   state and flushes summaries; an unflushed window is bounded loss, not corruption
   (same model as `docs/adr/003-irc-bridge-state.md`).

---

## Rationale

- **Goroutines express the pattern more simply** than OS threads + mutex-guarded
  queues: the netpoller gives goroutine-per-request for free, a channel + single
  consumer replaces lock-guarded flush queues, and a `time.Ticker` replaces a
  hand-rolled schedule loop.
- **The expensive half already exists.** korin's shared-secret flush-window
  back-channel to stellar (stellar-api ADR-0013) is the integration; we add a
  working set, not a new boundary.
- **One deploy story.** Ergo proves a non-JS package builds cleanly under the pnpm
  `packages/*` workspace + compose; `ledger` follows the same shape, so the single
  `docker compose` deploy is preserved.
- **`net/http` suffices.** An internal service with a handful of endpoints needs no
  web framework; zero deps keeps the image small and the supply chain narrow.

---

## Consequences

- A second toolchain (Go) enters the Node/pnpm repo, **isolated** to
  `packages/ledger/` with its own `go.mod`/`Dockerfile` and CI lane.
- **Phase 1 first target:** the IRC metrics flush, which already matches this
  pattern — porting it proves the core end-to-end with **no new stellar contracts**.
- **Phase 2 dependency:** stellar-api must expose **consumption-event** and
  **ratio-gate** contracts (extending stellar-api ADR-0013) before real accounting
  lands — the gating cross-repo work.
- **Freepass / Neutralpass** (ratio-exempt consumption — Freepass still credits the
  contributor, Neutralpass credits neither side) and **stem / multi-contributor
  credit attribution** are deferred economy/design layers, not v0.x.
- Supersedes nothing; **extends** `docs/adr/001-ergo-irc-daemon.md` (Go in the
  stack) and **stellar-api ADR-0013** (the boundary). Phasing is tracked in the
  orchestrator's working roadmap.
