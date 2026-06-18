# @korin/ledger

korin.pink's hot-path **accounting authority** (Go). See `docs/adr/004-go-accounting-service.md`.

Holds a recoverable in-memory working set of **consumption** accounting and
flushes batched summaries to **stellar-api** over the shared-secret back-channel
(stellar-api ADR-0013). Stellar stays the system of record; an unflushed window is
bounded loss (model from `docs/adr/003-irc-bridge-state.md`).

## Pattern

The legacy threaded-tracker shape, expressed in Go:

- **net/http** goroutine-per-request server (`/healthz` for now).
- buffered **channel** → a single **batched-flush goroutine** (replaces lock-guarded flush queues).
- **`time.Ticker`** scheduler; **`sync/atomic`** stat counters.
- in-memory working set (`contribution_list` analog) under `sync.RWMutex`.
- graceful shutdown: drain buffered events → final flush.

## Run

```bash
cd packages/ledger
go run .            # listens on :3001, flushes every 60s
curl localhost:3001/healthz
```

## Config (env)

| Var | Default | Purpose |
| --- | --- | --- |
| `LEDGER_PORT` | `3001` | HTTP listen port (internal) |
| `LEDGER_FLUSH_INTERVAL_MS` | `60000` | batched-flush interval |
| `STELLAR_API_URL` | — | flush target (system of record) |
| `STELLAR_API_KEY` | — | Bearer for the shared-secret channel |

## Status

**Phase 0 skeleton.** Config + server + the store/flush pattern + graceful
shutdown. Phase 1 ports the IRC metrics flush onto this core; Phase 2 adds the
`POST /consumption` ingestion endpoint and the real stellar-api flush once those
contracts land. Nomenclature is domain-only (consumption, Contribution,
`canConsume`, Effective Availability, Freepass) — never legacy/tracker terms.
