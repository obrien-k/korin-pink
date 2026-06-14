# Domain Guidance

Domain-specific context for agents working in the Korin scheme.

---

## The Korin Scheme

`korin.{color}` is a naming convention for community infrastructure deployments.
Each instance is an independent full-stack deployment serving the Stellar ecosystem.

**Current instances:**

| Domain      | Repo                    | Status |
| ----------- | ----------------------- | ------ |
| korin.pink  | obrien-k/korin-pink     | active |

**Naming rules:**
- Domains follow the pattern `korin.{color}` where `{color}` is a valid CSS color name
- Each instance is self-contained: its own domain, codebase, and GCP project (or VPS)
- Shared conventions live in `obrien-k/korin-omnibus` (this repo)
- Do not create new `korin.{color}` instances without an ADR

---

## Stellar Platform

**Repo:** `orphic-inc/stellar-api`
**Description:** "API for the next generation mirage."

Stellar is the upstream platform. korin.pink is downstream infrastructure feeding Stellar's Community Reputation Score (CRS).

### CommunityReputationScore (CRS)

```
CommunityReputationScore =
  FriendsScore
+ InviteScore
+ DonationScore
+ LongevityScore

CommunityValueIndex =
  RatioScore
+ CommunityReputationScore
+ IRCScore                    ← korin.pink feeds this
+ FeedScore
+ CommunityParticipationScore
```

**IRC signals Korin is responsible for:**

| Signal field     | Description                              |
| ---------------- | ---------------------------------------- |
| stellarUserId    | Stellar account ID (resolved via SASL)   |
| nick             | IRC nick at time of flush                |
| presenceSeconds  | Seconds online in the flush window       |
| messageCount     | Total messages sent in window            |
| channels         | Array of channel names participated in   |
| lastSeen         | ISO timestamp of last observed activity  |

**Do not implement score weighting.** The formula `activity * consistency * channelQuality` is owned and computed by `stellar-api`. Korin emits raw signals and reports them on request.

### stellar-api Endpoints (expected)

| Method | Path                               | Called by       |
| ------ | ---------------------------------- | --------------- |
| PUT    | /users/:id/irc-nick                | korin (on SASL) |
| POST   | /reputation/irc-metrics            | stellar-api POV: korin pushes; actual: stellar polls korin |
| GET    | /users/:id/reputation              | korin (read-only display) |

> ⚠️ Exact signatures TBD. See open question #1 in `CONTEXT.md` and `orphic-inc/stellar-api` issues.

---

## Ergo IRCd

Ergo is the IRC daemon. Key facts for agents:

- Config lives in `packages/irc/ergo.yaml` in `korin-pink`
- Accounts use `force-nick-equals-account: true` — a user's nick is their account name
- SASL PLAIN is the intended auth mechanism; credentials map to Stellar account tokens
- Ergo stores data in Buntdb (`ircd.db`) — embedded, no separate DB process needed
- Ergo does **not** have a built-in REST API in stable releases; metrics are extracted by the irc-bridge bot via operator IRC commands
- History is enabled with 7-day retention for registered channels

**Oper accounts:**
- `stellar-bridge` — the irc-bridge bot's operator account. Hidden. Class: `bot`.
- Password hash generated with `ergo genpasswd`. Never store plaintext.

---

## irc-bridge

The bridge is a Node.js process that connects to Ergo as an operator bot using `irc-framework`.

**Session lifecycle:**
- On `JOIN`: start tracking nick, resolve stellarUserId async
- On `PRIVMSG`: increment messageCount for that nick
- On `PART`/`QUIT`: remove from active sessions (presence accrues only while online)
- Every `FLUSH_INTERVAL_MS` (default 15 min): POST accumulated metrics to korin API, reset counters

**Nick → stellarUserId resolution:**
- On first sight of a nick, query `GET /irc/users/:nick/stellar-id` on the korin API
- korin API proxies to `stellar-api`
- Cache result in memory; invalidate on `NICK` change

**Known limitation (v0.1.0):** metrics in-memory only. A bridge crash loses the current window's data. This is acceptable for v0.x. See `docs/adr/003-irc-bridge-state.md`.

---

## Google Workspace

korin.pink integrates with Google Workspace for the `korin.pink` custom domain:

| Service      | Use                                         |
| ------------ | ------------------------------------------- |
| Gmail API    | Send/receive at `*@korin.pink` addresses    |
| Google Drive | File storage and wiki article backend       |
| Gemini API   | AI tools (summarize, expand, generate)      |

Authentication uses Application Default Credentials (ADC) via a GCP service account.
Domain-wide delegation is required for Gmail API access.

---

## Deployment Targets

| Target    | Status    | Notes                              |
| --------- | --------- | ---------------------------------- |
| GCP       | default   | Cloud Run + Compute Engine + Drive |
| VPS       | supported | OVH, Hetzner, bare metal + Caddy  |
| Self-host | supported | Docker Compose + mkcert/ngrok      |
| AWS       | descoped  | See ADR-002                        |

Ergo requires a persistent TCP process. It cannot run on Cloud Run, Lambda, or any serverless platform.
