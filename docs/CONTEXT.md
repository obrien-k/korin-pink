# CONTEXT.md

Current project and domain context for `obrien-k/korin-omnibus`.

> Update this file when the active focus shifts, a major decision is made, or a milestone is reached.
> Keep it current. Stale context is worse than no context.

---

## Active Focus

**Phase:** v0.1.0 scaffold — korin.pink initial deployment

**Current work:**
- Monorepo scaffolded: `obrien-k/korin-pink` (api, web, irc, irc-bridge)
- Ergo IRCd config drafted; pending first-run oper password setup
- irc-bridge connects to Ergo, tracks presence/messages/channels, flushes to korin API
- korin API exposes `POST /irc/metrics` (bridge push) and `GET /irc/metrics` (stellar-api pull)
- Deployment docs complete: self-host, VPS (OVH/Hetzner), GCP

**Immediate next steps:**
1. Push `obrien-k/korin-pink` to GitHub, init `obrien-k/korin-omnibus`
2. Wire `stellar-api` endpoints: `PUT /users/:id/irc-nick`, `POST /reputation/irc-metrics`
3. First-run Ergo on GCP Compute Engine; issue cert via certbot
4. Validate irc-bridge flush cycle end-to-end
5. Add `CLAUDE.md` to `obrien-k/korin-pink` (implementation-level commands)

---

## The Korin Scheme

`korin.{color}` is a naming convention for community infrastructure deployments.

| Domain       | Status    | Role                                          |
| ------------ | --------- | --------------------------------------------- |
| korin.pink   | active    | IRC + data hub for Stellar                    |
| korin.{*}    | reserved  | Future deployments under the same scheme      |

Each instance is independent but follows shared conventions defined in this omnibus repo.

---

## Stellar Integration

**Upstream:** `orphic-inc/stellar-api`

korin.pink is Stellar's IRC infrastructure. IRC activity feeds the Community Reputation Score:

```
CommunityValueIndex =
  RatioScore
+ CommunityReputationScore   ← FriendsScore + InviteScore + DonationScore + LongevityScore
+ IRCScore                   ← korin.pink feeds this (PRD v0.0.4, planned v0.1.x)
+ FeedScore
+ CommunityParticipationScore
```

**IRCScore signals emitted by korin.pink:**
- `presenceSeconds` — time online per flush window
- `messageCount` — messages sent
- `channelCount` — unique channels

**Weighting formula is owned by stellar-api.** Korin does not compute scores.

**PRD version in scope:** v0.0.1–v0.0.4 (friends, invites, donations, longevity baseline).
IRC scoring is v0.1.x — korin.pink infrastructure is being built ahead of the scoring implementation.

---

## Tech Stack

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| IRC          | Ergo v2.14+ (IRCv3, SASL, history, TLS)        |
| API          | Node.js 20, Fastify 4, TypeScript (strict)     |
| AI           | Gemini 1.5 Flash (`@google/generative-ai`)     |
| File storage | Google Drive (`googleapis`)                    |
| Mail         | Gmail API, korin.pink custom domain            |
| Proxy        | Caddy 2 (auto TLS, reverse proxy)              |
| Monorepo     | pnpm workspaces + turborepo                    |
| Default infra| GCP (Cloud Run, Compute Engine, Cloud Storage) |
| IaC          | Terraform (`infra/gcp/main.tf`)                |
| CI/CD        | GitHub Actions (multi-target: GCP, VPS)        |

---

## Open Questions

| # | Question                                                                 | Owner        |
| - | ------------------------------------------------------------------------ | ------------ |
| 1 | What are the stellar-api endpoint signatures for irc-nick and metrics?   | orphic-inc   |
| 2 | Does stellar-api auth use Bearer token or API key for the bridge?        | orphic-inc   |
| 3 | Should korin-omnibus track other `korin.{color}` instances as submodules?| obrien-k     |
| 4 | irc-bridge state persistence: Cloud SQL vs Firestore vs ephemeral?       | obrien-k     |
| 5 | SASL auth flow: Stellar credentials vs Ergo-native accounts?             | both         |

---

## Decisions Made

| Decision                                        | Rationale                                      | ADR          |
| ----------------------------------------------- | ---------------------------------------------- | ------------ |
| Ergo as IRC daemon                              | Single binary, IRCv3, SASL, Go, minimal deps   | adr/001      |
| GCP default, deployment-agnostic docs           | Workspace integration; community may self-host | adr/002      |
| irc-bridge as separate stateless service        | Isolation; bridge crash doesn't affect API     | adr/003      |
| AWS descoped                                    | Complexity without benefit given GCP+Workspace | adr/002      |
| Drive as file storage                           | Already in Workspace; no additional cost       | —            |
| Gemini 1.5 Flash for AI                         | Native GCP, fast, Workspace-native             | —            |

---

## Milestones

| Milestone   | Description                                        | Status     |
| ----------- | -------------------------------------------------- | ---------- |
| v0.1.0      | Monorepo scaffold, Ergo config, irc-bridge, docs   | 🔧 in prog |
| v0.2.0      | stellar-api integration wired, end-to-end flush    | pending    |
| v0.3.0      | korin.pink live on GCP, IRC open to Stellar users  | pending    |
| v0.4.0      | Wiki content populated, AI tools live              | pending    |
| v1.0.0      | IRCScore feeding CRS in stellar-api production     | pending    |
