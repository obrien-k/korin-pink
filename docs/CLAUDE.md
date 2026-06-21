# CLAUDE.md

> Claude Code configuration for `obrien-k/korin-pink`.
> Start every session by reading `docs/home.md`, then `docs/CONTEXT.md`.

---

## Project Identity

**Repo:** `obrien-k/korin-pink` — the implementation repo (fork-only; `origin` = obrien-k)
**Scheme:** `korin.{color}` — community infrastructure deployments
**This instance:** `korin.pink` — IRC + data hub for Stellar (`orphic-inc/stellar-api`)
**Org:** orphic-inc (upstream product); obrien-k (Korin infra)

> Shared `korin.{color}` conventions are tracked in `obrien-k/korin-omnibus` (content/landing).
> Per `docs/GOVERNANCE.md`, korin-omnibus holds **no ADRs** — this repo's ADRs live in `docs/adr/`.

---

## Codebase Layout

```
korin-pink/             ← you are here (impl repo)
  packages/
    api/                ← Fastify + TS (files, wiki, IRC metrics + verify, AI, mail)
    web/                ← minimal static portal
    irc/                ← Ergo IRCd config + Dockerfile
    irc-bridge/         ← Node bot: Ergo → metrics + !verify relay → stellar-api
  infra/
    docker-compose.yml  ← universal baseline (deployment-agnostic)
    Caddyfile
    gcp/main.tf
  docs/
    home.md             ← start here
    CONTEXT.md          ← current focus + decisions
    AGENTS.md           ← agent workflow
    adr/                ← architectural decision records (001, 002, 003)
    deploy/             ← self-host, VPS, GCP guides
```

---

## Key Commands (korin-pink)

```bash
# install
pnpm install

# dev (all packages in parallel)
pnpm dev

# build
pnpm build

# run a single package
pnpm --filter @korin/api dev
pnpm --filter @korin/irc-bridge dev

# local stack (Docker)
cd infra && docker compose up --build

# first-run Ergo oper password
docker compose exec ergo ergo genpasswd
```

---

## Environment

Minimum `.env` to run locally:

```
STELLAR_API_URL=
STELLAR_API_KEY=
STELLAR_PULL_KEY=
GEMINI_API_KEY=
IRC_BRIDGE_SECRET=        # any random string
DRIVE_ROOT_FOLDER_ID=
DRIVE_WIKI_FOLDER_ID=
GOOGLE_APPLICATION_CREDENTIALS=./infra/secrets/gcp-service-account.json
```

---

## Stellar Integration Contract

Authoritative source: **stellar-api ADR-0013 §Integration contract**. Metrics are
**pull-only**; korin never pushes metrics to stellar.

**Flows:**

- **Metrics (stellar pulls korin):** the irc-bridge flushes to korin's own
  `POST /irc/metrics` (`x-bridge-secret: IRC_BRIDGE_SECRET`, internal). stellar-api
  then polls `GET /irc/metrics` with `x-pull-key: $STELLAR_PULL_KEY`.
- **Announce (stellar pushes korin):** stellar-api POSTs release RSS to korin's
  `POST /irc/announce` (`x-pull-key: $STELLAR_PULL_KEY`); korin renders it to IRC.
- **Verify (ADR-0015):** a member sends `!verify <code>` privately to the bridge bot.
  The bridge relays it to korin's `POST /irc/verify` (`x-bridge-secret`), which calls
  `stellar.verifyNick(nick, code)` → stellar-api `POST /api/users/irc-nick/verify`.
  This proves nick ownership without delegated SASL (rests on `force-nick-equals-account`).
- **korin → stellar calls** (`Authorization: Bearer $STELLAR_API_KEY`):
  `GET /api/users/by-irc-nick/:nick`, `PUT /api/users/:id/irc-nick` (`{ ircNick }`),
  `POST /api/users/irc-nick/verify` (`{ nick, code }`), `GET /api/users/:id/reputation`.
  See `lib/stellar.ts`.

`GET /irc/metrics` payload shape (raw signals, keyed by nick):
```typescript
{
  users: Array<{
    nick:            string
    stellarId?:      string
    presenceSeconds: number
    messageCount:    number
    channelCount:    number
    channels:        string[]
    windowStart:     number   // unix epoch ms
    windowEnd:       number
  }>
  lastFlushAt: number | null
}
```

`stellar-api` owns the weighting formula:
```
IRCScore = activity * consistency * channelQuality   // PRD v0.0.4
```

Do not implement scoring logic in this repo. Emit raw signals only.

---

## Coding Conventions

- **Language:** TypeScript (strict mode). Go only if a package explicitly opts in.
- **Runtime:** Node.js 20+
- **Package manager:** pnpm workspaces + turborepo
- **HTTP:** Fastify 4. No Express.
- **Validation:** Zod at every API boundary. No `any`.
- **Imports:** ESM only (`"type": "module"`). Use `.js` extensions in TS imports.
- **Formatting:** No config yet — match surrounding file style.
- **Secrets:** Never hardcode. Always read from `process.env`. Throw on missing required vars at startup.

---

## What Not To Do

- Do not implement `IRCScore` weighting here — stellar-api owns that formula.
- Do not add Express, Koa, or any non-Fastify HTTP framework.
- Do not push to `main` directly. Branch + PR.
- Do not commit `.env`, `gcp-service-account.json`, or any TLS key material.
- Do not add GCP-only constructs to `docker-compose.yml` — it must stay deployment-agnostic.
- Do not add AWS infra. AWS was explicitly descoped. See `docs/adr/002-deployment-targets.md`.

---

## Agent Workflow

1. Read `docs/home.md` → `CONTEXT.md` → `AGENTS.md`
2. Check open issues in `obrien-k/korin-omnibus` and `obrien-k/korin-pink`
3. Branch from `main`: `feat/`, `fix/`, `docs/`, `chore/`
4. PR title format: `type(scope): description` — e.g. `feat(irc-bridge): add nick→stellarId cache TTL`
5. Tag PRs with appropriate triage labels (see `docs/agents/triage-labels.md`)
