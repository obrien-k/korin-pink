# CONTEXT.md

Current project and domain context for `obrien-k/korin-pink`.

> Update this file when the active focus shifts, a major decision is made, or a milestone is reached.
> Keep it current. Stale context is worse than no context.

---

## Active Focus

**Phase:** v0.3.0 released; v0.4.0 in flight — announce delivery leg landed

**What's implemented:**
- irc-bridge daemon (`packages/irc-bridge/src/index.ts`): connects to Ergo via TLS + SASL, tracks join/part/quit/nick/privmsg per user, flushes `{ users: UserMetrics[] }` to `POST /irc/metrics` every 60s (`FLUSH_INTERVAL_MS`)
- irc-bridge delivery endpoint (`packages/irc-bridge/src/deliver.ts`): `POST /say` on `IRC_BRIDGE_PORT` (default 8081), auth `x-bridge-secret`. Bound to the compose network, never published. Rejects any channel the bridge has not joined (ADR-006)
- korin API (`packages/api/src/routes/irc.ts`):
  - `POST /irc/metrics` — bridge push, auth: `x-bridge-secret: IRC_BRIDGE_SECRET`
  - `GET /irc/metrics` — stellar-api pull, auth: `x-pull-key: STELLAR_PULL_KEY`
  - `POST /irc/announce` — stellar-api push, auth: `x-pull-key: STELLAR_PULL_KEY`; renders the item and posts it to `ANNOUNCE_CHANNEL` (default `#announce`) via the bridge. Returns **503** when the line cannot be delivered, so stellar's cursor holds and re-pushes (ADR-006)
  - `POST /irc/verify` — bridge relays a member's `!verify <code>`, auth: `x-bridge-secret: IRC_BRIDGE_SECRET`; proxies to `stellar.verifyNick` → stellar-api `POST /api/users/irc-nick/verify` (ADR-0015)
  - In-process store; no DB dependency for metrics
- stellar-api (on trunk since #163): `User.ircNick`, `PUT /users/:id/irc-nick`, `ircJob.ts` (polls every 5min), IRCScore in CRS REGISTRY

**Immediate next steps:**
1. `<category>` contract mismatch (#73) — stellar writes the community name; korin's parser accepts four content types and coerces the rest to `announcement`, so every delivered line renders `[ANNOUNCEMENT]`
2. Production images run `tsx watch` and ignore the lockfiles (#77)
3. No test/typecheck CI gate on PRs (#72)

---

## API endpoints

| Method | Path | Auth header | Caller |
|---|---|---|---|
| `POST` | `/irc/metrics` | `x-bridge-secret` | irc-bridge |
| `GET` | `/irc/metrics` | `x-pull-key` | stellar-api |
| `POST` | `/irc/verify` | `x-bridge-secret` | irc-bridge |
| `POST` | `/irc/announce` | `x-pull-key` | stellar-api (`announceJob`) |

The delivery leg runs the other way across the same boundary — api → bridge, on the
bridge's own listener, not the API:

| Method | Path | Auth header | Caller | Service |
|---|---|---|---|---|
| `POST` | `/say` | `x-bridge-secret` | korin api | irc-bridge (`IRC_BRIDGE_PORT`) |

## Environment variables (irc-bridge)

| Var | Default | Description |
|---|---|---|
| `IRC_HOST` | `localhost` | Ergo server hostname |
| `IRC_PORT` | `6697` | IRC port |
| `IRC_TLS` | `true` | Enable TLS |
| `IRC_NICK` | `stellar-bridge` | Bridge bot nick |
| `IRC_SASL_USER` | — | Ergo account username |
| `IRC_SASL_PASS` | — | Ergo account password |
| `KORIN_API_URL` | `http://localhost:3000` | korin API base URL |
| `IRC_BRIDGE_SECRET` | — | Shared secret for both directions of the api↔bridge boundary: `POST /irc/metrics`, `/irc/verify`, and the bridge's own `POST /say` |
| `IRC_BRIDGE_PORT` | `8081` | Port the bridge's `POST /say` delivery endpoint binds |
| `FLUSH_INTERVAL_MS` | `60000` | Flush cadence in ms |

API-side counterparts: `IRC_BRIDGE_URL` (where the api reaches the bridge) and
`ANNOUNCE_CHANNEL` (default `#announce`).

---

## Stellar Integration

**Upstream:** `orphic-inc/stellar-api`

korin.pink is Stellar's IRC infrastructure. IRC activity feeds the CRS:

```
IRCScore = activity × consistency × channelQuality   (cap = 2 — deliberately thin until real IRC traffic; stellar #141)

activity       = log1p(messageCount)   / log1p(50)
consistency    = presenceSeconds / windowDurationSeconds
channelQuality = log1p(channelCount)   / log1p(5)
```

**Integration pattern:** stellar-api pulls `GET /irc/metrics` every 5 min. Webhooks evaluated and deferred (see stellar-api ADR-0013). Korin emits raw signals only — scoring is stellar-api's responsibility.

**Nick mapping:** users link their Ergo nick to their Stellar account via `PUT /api/users/:id/irc-nick` on stellar-api (unique constraint). Ownership of the nick is **verified** (stellar-api ADR-0015): the member sends `!verify <code>` privately to the bridge bot, which relays it through korin's `POST /irc/verify` to stellar's `POST /api/users/irc-nick/verify`. Verification is *not* via SASL — it proves nick control through the challenge code, resting on Ergo's `force-nick-equals-account`. SASL itself stays Ergo-native (Buntdb); there is no Stellar credential→SASL bridging (ADR-0013).

---

## Tech Stack

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| IRC          | Ergo v2.14+ (IRCv3, SASL, history, TLS)        |
| API          | Node.js 22, Fastify 4, TypeScript (strict)     |
| IRC client   | `irc-framework` ^0.20.0                        |
| AI           | Gemini 1.5 Flash (`@google/generative-ai`)     |
| File storage | Google Drive (`googleapis`)                    |
| Mail         | Gmail API, korin.pink custom domain            |
| Proxy        | Caddy 2 (auto TLS, reverse proxy)              |
| Monorepo     | pnpm workspaces                                |
| Default infra| GCP (Cloud Run, Compute Engine, Cloud Storage) |
| CI/CD        | GitHub Actions (multi-target: GCP, VPS)        |

---

## Open Questions

| # | Question | Owner | Status |
| - | -------- | ----- | ------ |
| 3 | Should korin-omnibus track other `korin.{color}` instances as submodules? | obrien-k | open |
| 4 | irc-bridge state persistence beyond ephemeral? | obrien-k | ephemeral for v0.1.x; revisit at v0.3.0 |
| 5 | SASL: Stellar credentials vs Ergo-native accounts? | both | **resolved** — Ergo-native (Buntdb); delegated SASL killed by ADR-0013. Nick↔Stellar link is the ADR-0015 verified-nick proof, not SASL. |
| 6 | irc-bridge pairwise mention tracking: irc-bridge must parse PRIVMSG for nick mentions and emit `interactions: [{ from, to, mentionCount }]` alongside per-user metrics in each flush. Needed for stellar-api's IRC Mutual-Mention × Friends negative CRS vector (PRD-03). | obrien-k | **emission shipped** (#42): bridge emits raw directional `interactions[]` + per-channel `channelMessages`. The threshold/decay (min mentions/direction/7d) lives in stellar-api — korin only emits the raw signal. |

---

## Decisions Made

| Decision | Rationale | Ref |
| -------- | --------- | --- |
| Ergo as IRC daemon | Single binary, IRCv3, SASL, Go, minimal deps | adr/001 |
| GCP default, deployment-agnostic docs | Workspace integration; community may self-host | adr/002 |
| irc-bridge as separate stateless service | Isolation; bridge crash doesn't affect API | adr/003 |
| Pull (polling) over webhooks | Simpler; tolerates downtime; no retry needed at v0.1.x scale | stellar-api ADR-0013 |
| irc-bridge state ephemeral for v0.1.x | Flush windows short; loss on restart is one 60s window | adr/003 |
| Verified nick link (`!verify <code>` relay), not self-reported | Proves nick ownership without delegated SASL; rests on `force-nick-equals-account` | stellar-api ADR-0015 |
| `irc-framework` as IRC client | IRCv3 support, SASL PLAIN, active maintenance | — |
| Portal + wiki as one Astro app (`packages/web`) | One build, one lockfile, `/wiki/*` URLs preserved; retires the standalone Docusaurus project and its nginx container | adr/005 |
| Announce delivery pushes api → bridge `POST /say`, fails loud with 503 | stellar already owns durable retry; a bridge-side buffer would advance the cursor then lose the item | adr/006 |
| Ledger service withdrawn | Superseded; scaffold removed in #68 | adr/004 (superseded) |

---

## Milestones

| Milestone | Description | Status |
| --------- | ----------- | ------ |
| v0.1.0 | Monorepo scaffold, Ergo config, irc-bridge daemon, RSS parser, docs | ✅ done |
| v0.2.0 | stellar-api integration wired, end-to-end flush validated | ✅ done |
| v0.3.0 | korin.pink live on GCP, IRC open to Stellar users | ⚠️ see note |
| v0.4.0 | Wiki content populated, AI tools live | 🔧 in prog — IRC wiki pages written; web portal + wiki migrated to Astro + Starlight (ADR-005); seed script in stellar-api |
| v1.0.0 | IRCScore feeding CRS in stellar-api production | pending |

> These milestone labels are goals, not release tags — the `v0.x` here does not track
> the release-please version. The tagged releases are independent (0.3.0 cut
> 2026-07-12; 0.4.0 in flight).
>
> **Unresolved (flagged by the 2026-07-23 sweep):** the v0.3.0 milestone says "live on
> GCP", but the deployment that actually exists is the VPS box (`docs/deploy/vps.md`,
> `infra/deploy.sh`, #57), while ADR-002 still names GCP the default target. Someone
> who knows where korin.pink actually runs should settle this row.
