# Repo governance & real-estate map

> Single source of truth for **which clone is canonical**, **where ADRs live**, and **how korin↔stellar
> work flows**. Written 2026-06-16 after a survey found the IRC "auth-model divergence" was a phantom
> caused by reading a stale fork clone. Read this before trusting any session handoff.

## The estate

Two parallel clone families with mirrored remotes:

- **`~/git/<repo>`** — tracks **orphic-inc** as `origin`; checked out on live feature branches.
  **This is the source of truth.** Upstream product work happens here.
- **`~/git/obrien-k/<repo>`** — fork: `origin`=obrien-k, `upstream`=orphic-inc; parked on `main`.
  Staging mirror only. **Treat as potentially stale.**

| Repo | Authoritative clone | Fork/staging clone |
|---|---|---|
| stellar-api | `~/git/stellar-api` (orphic; develop-line) | `~/git/obrien-k/stellar-api` |
| stellar-compose | `~/git/stellar-compose` (orphic) | `~/git/obrien-k/stellar-compose` |
| stellar-ui | `~/git/stellar-ui` (orphic) | `~/git/obrien-k/stellar-ui` |
| korin-pink | `~/git/obrien-k/korin-pink` (the impl repo — fork-only) | — |
| korin-omnibus | `~/git/korin-omnibus` (content/landing; **NOT an ADR home**) | — |
| bc-stellar | `~/git/bc-stellar` (legacy, 2022 — out of scope) | — |

## Rules

1. **Source of truth is `upstream/develop` @ orphic-inc** for all `stellar-*` repos. Always
   `git fetch --all` before reasoning about state.
2. **korin↔stellar integration work lands as PRs onto `upstream/develop`**, never onto a fork `main`.
   A change merged only into `obrien-k/<repo>/main` has not shipped.
3. **ADRs live per-repo in `<repo>/docs/adr`.** stellar-api is the home of the IRC/integration ADRs
   (0011–0013). **korin-omnibus holds zero ADRs** — do not cite it as the ADR/coordination repo.
4. **Never trust env vars read from a fork clone** as the contract. The contract is the ADR
   (stellar-api ADR-0013 §Integration contract), not whatever `.env.default` a stale `main` carries.

## IRC auth model — decided, do not re-litigate

**Native Ergo accounts + self-reported nick.** Per **stellar-api ADR-0013 (Accepted)**, which
**supersedes ADR-0011** (delegated SASL). korin owns IRC identity; stellar consumes IRC signals via
pull and trusts the self-reported `ircNick` (no SASL validation). The delegated-SASL seam was deleted
from stellar-api. Ergo *can* technically delegate via an `auth-script` subprocess, but we deliberately
don't — see `packages/irc/ergo.yaml` and ADR-0013. Reopening this requires amending ADR-0013.

## Integration contract (authoritative key map — from ADR-0013)

| Role | korin name | stellar name | Same value? |
|---|---|---|---|
| stellar→korin pull/announce | `STELLAR_PULL_KEY` | `KORIN_PULL_KEY` | **YES** |
| korin→stellar bearer | `STELLAR_API_KEY` | `STELLAR_SERVICE_KEY` | **YES** |
| korin API base URL | `STELLAR_API_URL`→stellar; `KORIN_API_URL` (stellar→korin) | `KORIN_API_URL` | n/a |

> Note: the legacy names `STELLAR_IRC_BOT_TOKEN` / `STELLAR_IRC_SASL_SECRET` are **dead** — removed by
> ADR-0013. If you see them in a clone, that clone is stale; sync it to `upstream/develop`.

## Known governance debt (2026-06-16)
- `~/git/obrien-k/stellar-api` is behind: 12 ADRs (missing 0013) + stale `STELLAR_IRC_*` env. Sync it.
- Two `develop` merges (PRs #97/#98) are merged locally but **not pushed to `upstream/develop`**;
  #98 is a **destructive contract migration** — fresh-DB only.
- Scattered uncommitted trees: stellar-ui (14), korin-omnibus (14), obrien-k/stellar-compose (6).
- korin-omnibus is a stale 2024 content branch — decide whether to retire or rebuild it.
- A per-user `feed.xml`/RSS contribution feed is desired but reintroduces the per-user credential that
  ADR-0011→0013 deleted; it needs its own ADR before being built.
