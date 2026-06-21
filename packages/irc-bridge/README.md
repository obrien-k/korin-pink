# @korin/irc-bridge

Bridges IRC activity into korin's metrics PULL contract (ADR-0013). The bridge
SASL-connects to Ergo as `stellar-bridge`, joins the core channels, accumulates a
per-user flush window (presence, messages, channels), and POSTs raw signals to
korin's `POST /irc/metrics`; stellar-api pulls them from `GET /irc/metrics`.

## Layout

- `src/bridge.ts` — `createBridge(config, deps)`: the testable core. All
  accumulation, event wiring, flush, verify relay, and reconnect live here behind
  injectable deps (`client`, `fetchImpl`, `now`, `scheduleReconnect`) and do **no
  work at import**. Mirrors korin's `buildServer(config, deps?)`.
- `src/index.ts` — thin entrypoint: reads env, builds the real `irc-framework`
  client (`auto_reconnect: false`), calls `createBridge(...).start()`.
- `src/resolve.ts`, `src/verify.ts` — pure helpers (nick → stellarId, `!verify`).

## Tests

```sh
npm test     # unit — node:test, no network/containers
npm run build
```

`test/bridge.test.ts` drives synthetic events through a fake client + injected
`fetch`/clock and asserts the **flush payload** (never internal state).

## Watchpoint notes (from #20)

- **WHO seeding.** `WHO * %nuha` emits **no `wholist`** under `irc-framework` v4 (the
  reply carries no WHOX token, so the framework drops it). Seeding goes through
  `client.who('*')`, whose tokened WHOX carries the channel; the `wholist` handler
  also tolerates a missing channel. Live channel membership is primarily seeded by
  join events (the bridge joins the channels it monitors).
- **Reconnect.** v4 defaults `auto_reconnect: true`. The real client is built with it
  **off** so `createBridge` owns the single guarded reconnect path — a dropped socket
  schedules exactly one reconnect.

## End-to-end smoke

On-demand proof the whole IRC → metrics → stellar path runs against a live Ergo.
Requires Docker; not a CI gate.

```sh
npm run smoke
```

It boots Ergo + korin api + bridge via `infra/docker-compose.smoke.yml` (a
self-contained, plaintext, clean-checkout-runnable stack — distinct from the
TLS-only production `infra/docker-compose.yml`), registers the `stellar-bridge`
account, drives a join + messages in `#stellar` from a second client, waits one
short flush window, asserts `GET /irc/metrics` returns populated, well-formed raw
signals, then tears the stack down (`down -v`). stellar-api is not wired, so
`stellarId` is absent by design — the smoke asserts the raw signals, not attribution.
