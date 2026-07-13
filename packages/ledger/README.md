# @korin/ledger

korin.pink's hot-path **accounting authority** (Go). See
`docs/adr/004-go-accounting-service.md` and the contract in stellar-api
`docs/adr/0016-ledger-accounting-contract.md`.

A **derived read-model**, not a parallel authority: stellar-api is the system of
record and the origin of every consumption event. korin seeds an in-memory working
set from stellar's snapshot, advances it with pre-resolved grant deltas, and answers
the grant-time gate + live stats. It owns **no numbers to flush back** — stellar
already persisted the truth. On restart it reloads the snapshot; an unflushed window
is bounded loss (`docs/adr/003-irc-bridge-state.md`).

## Pattern

- **net/http** goroutine-per-request server, zero third-party deps.
- buffered **channel** → a single **applier goroutine** (the only writer); handlers
  enqueue and return.
- in-memory working set (`contribution_list` analog) under `sync.RWMutex`.
- **`time.Ticker`** re-pulls the snapshot to keep policy/contribution state fresh.
- graceful shutdown: drain buffered events → return.

## Endpoints

Inbound stellar → korin calls carry `x-pull-key: STELLAR_PULL_KEY` (fails closed when
unset). `/healthz` is open.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/ledger/consumption` | stellar pushes a pre-resolved event `{grantId, kind, userId, contributorId, contributionId, consumedDelta, contributedDelta, pass, at}`. Idempotent on `(grantId, kind)`; deltas are BigInt-as-string (reversals are pre-negated). korin only sums. |
| `GET` | `/ledger/can-consume?userId=&contributionId=` | Grant-time gate → `{allow, reason, currentRatio, requiredRatio, policyState}`. `allow` rides the consumer's `canDownload` (false ⟺ `LEECH_DISABLED`); an unknown user fails **open**. stellar also fails open on any non-2xx/timeout. |
| `GET` | `/ledger/stats` | Global + per-user real-time activity counters (cache-friendly, like `/irc/metrics`). |
| `GET` | `/healthz` | Liveness. |

korin → stellar: `GET {STELLAR_API_URL}/api/ledger/snapshot` (Bearer
`STELLAR_API_KEY`) on boot and on each refresh tick. A snapshot is authoritative for
balances as of `generatedAt`, so a reseed **replaces** totals (self-healing — never
double-counts events already folded in) and resets the idempotency window.

> `currentRatio`/`requiredRatio` are informational. `requiredRatio` is best-effort:
> the snapshot omits contribution `createdAt`, so korin cannot apply stellar's 72h
> eligibility window — it counts approved links with `linkStatus != FAIL`. stellar
> keeps its own read-time truth; these numbers never gate.

## Run

```bash
cd packages/ledger
STELLAR_API_URL=http://localhost:4000 STELLAR_API_KEY=… STELLAR_PULL_KEY=… go run .
curl localhost:3001/healthz
curl -H 'x-pull-key: …' 'localhost:3001/ledger/can-consume?userId=1&contributionId=1'
```

## Config (env)

| Var | Default | Purpose |
| --- | --- | --- |
| `LEDGER_PORT` | `3001` | HTTP listen port (internal) |
| `LEDGER_REFRESH_INTERVAL_MS` | `60000` | snapshot re-pull cadence |
| `STELLAR_API_URL` | — | stellar base URL for the snapshot pull |
| `STELLAR_API_KEY` | — | Bearer, korin → stellar (== stellar's `STELLAR_SERVICE_KEY`) |
| `STELLAR_PULL_KEY` | — | expected `x-pull-key`, stellar → korin (== stellar's `KORIN_PULL_KEY`) |

## Status

**Phase 2** (ADR-0016 consumer side): consumption ingest + grant-time gate + live
stats + snapshot seed. The stellar producer half is shipped (orphic-inc/stellar-api
PR #323). **Deferred:** the `POST /ledger/sync` receiver (stellar producer is
stellar #324) — bridged for now by the periodic snapshot re-pull; a stellar consumer
of `/ledger/stats`; abuse/integrity signals (follow-on ADR); a public Caddy
`/ledger/*` route (ADR-004 kept the service internal until the contract landed).
