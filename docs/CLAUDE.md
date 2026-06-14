# CLAUDE.md

> Claude Code configuration for `obrien-k/korin-omnibus`.
> Start every session by reading `docs/home.md`, then `CONTEXT.md`.

---

## Project Identity

**Repo:** `obrien-k/korin-omnibus`
**Scheme:** `korin.{color}` — community infrastructure deployments
**Primary instance:** `korin.pink` — IRC + data hub for Stellar (`orphic-inc/stellar-api`)
**Org:** orphic-inc (upstream); obrien-k (Korin infra)

---

## Codebase Layout

```
korin-omnibus/          ← you are here (docs + coordination)
  CLAUDE.md
  AGENTS.md
  CONTEXT.md
  docs/
    home.md             ← start here
    adr/                ← architectural decisions
    agents/             ← workflow, labels, domain

korin-pink/             ← sibling implementation repo
  packages/
    api/                ← Fastify + TS (files, wiki, IRC metrics, AI, mail)
    web/                ← minimal static portal
    irc/                ← Ergo IRCd config + Dockerfile
    irc-bridge/         ← Node bot: Ergo → metrics → stellar-api
  infra/
    docker-compose.yml  ← universal baseline
    Caddyfile
    gcp/main.tf
  docs/deploy/          ← self-host, VPS, GCP guides
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

The IRC bridge flushes metrics to `POST /irc/metrics` (korin API).
`stellar-api` polls `GET /irc/metrics?flush=true` using `x-api-key: $STELLAR_PULL_KEY`.

Payload shape:
```typescript
{
  stellarUserId:   string
  nick:            string
  presenceSeconds: number
  messageCount:    number
  channels:        string[]
  lastSeen:        string   // ISO
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
