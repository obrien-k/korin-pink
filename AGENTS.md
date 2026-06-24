# AGENTS.md

You are working in `obrien-k/korin-pink` — the implementation monorepo for korin.pink, Stellar's IRC infrastructure layer.

Read this file fully before touching anything. Then read `docs/CONTEXT.md`. Then check open issues.

---

## Orientation

```
korin.pink serves two things:
  1. An Ergo IRC daemon at irc.korin.pink:6697
  2. A Fastify API that bridges Ergo activity → stellar-api CRS (IRCScore)

stellar-api owns the scoring formula. You emit raw signals. Never compute scores here.
```

**Org context:** `obrien-k` (this repo) → feeds → `orphic-inc/stellar-api`
**Omnibus docs:** `obrien-k/korin-omnibus` — read it if you need scheme-level context or ADRs

---

## Before You Start Any Task

```bash
# 1. confirm you're on main and clean
git status
git pull origin main

# 2. confirm packages install cleanly
pnpm install

# 3. check open issues for the relevant scope
gh issue list --label ready-for-agent
```

If the task touches `stellar-api` integration (anything in `src/lib/stellar.ts`, `src/routes/irc.ts`, or `packages/irc-bridge/`), check `CONTEXT.md § Open Questions` first. Do not implement against unconfirmed API contracts. File a `needs-info` issue and stop.

---

## Package Map

```
packages/
  api/                  Fastify HTTP API — Cloud Run
    src/
      index.ts          server entry, plugin registration
      lib/
        stellar.ts      stellar-api client (emit signals, resolve nicks)
        drive.ts        Google Drive (files + wiki storage)
        gemini.ts       Gemini 1.5 Flash (summarize, expand, stream)
        gmail.ts        Gmail API (send/receive @korin.pink)
      routes/
        files.ts        GET /files, POST /files/upload, GET /files/:id/download
        irc.ts          POST /irc/metrics (bridge push), GET /irc/metrics (stellar pull)
        wiki.ts         GET|POST /wiki, POST /wiki/:slug/ai-expand
        ai.ts           POST /ai/generate|summarize, GET /ai/stream
        mail.ts         POST /mail/send, GET /mail/inbox

  web/                  Static portal — Cloud Storage
    index.html
    styles.css
    main.js

  irc/                  Ergo IRCd — Compute Engine (persistent TCP)
    ergo.yaml           daemon config
    Dockerfile          builds from source, golang:1.22-alpine
    motd.txt

  irc-bridge/           IRC bot — Cloud Run (min 1 instance)
    src/index.ts        connects to Ergo, tracks events, flushes metrics

infra/
  docker-compose.yml    universal baseline (ergo, api, irc-bridge, caddy)
  Caddyfile             reverse proxy + auto TLS
  gcp/main.tf           Terraform for Cloud Run + Compute Engine + Cloud Storage

docs/deploy/
  self-host.md
  vps.md
  gcp.md
```

---

## Commands

### Dev

```bash
pnpm dev                          # all packages (turbo parallel)
pnpm --filter @korin/api dev      # api only (tsx watch)
pnpm --filter @korin/irc-bridge dev

pnpm build                        # all packages
pnpm --filter @korin/api build
```

### Local Stack (Docker)

```bash
cd infra

# first time: generate Ergo oper password
docker compose up ergo -d
docker compose exec ergo ergo genpasswd
# paste hash into packages/irc/ergo.yaml → opers.stellar-bridge.password
# then rebuild:
docker compose up ergo --build -d

# full stack
docker compose up --build

# logs
docker compose logs -f api
docker compose logs -f irc-bridge
```

### Type Check

```bash
pnpm --filter @korin/api exec tsc --noEmit
pnpm --filter @korin/irc-bridge exec tsc --noEmit
```

### GitHub

```bash
gh issue list
gh issue view <n>
gh pr create --title "type(scope): description" --body "closes #N"
gh pr list
```

---

## Environment

Minimum `.env` to run locally. Copy from `.env.example`:

```
STELLAR_API_URL=          # https://... — required, ask orphic-inc
STELLAR_API_KEY=          # Bearer token for stellar-api — required
STELLAR_PULL_KEY=         # stellar-api uses this to pull /irc/metrics
GEMINI_API_KEY=           # Google AI Studio
IRC_BRIDGE_SECRET=        # shared secret between bridge and API (any random string)
DRIVE_ROOT_FOLDER_ID=     # Google Drive folder ID for file storage
DRIVE_WIKI_FOLDER_ID=     # Google Drive folder ID for wiki articles
GOOGLE_APPLICATION_CREDENTIALS=./infra/secrets/gcp-service-account.json
```

`STELLAR_API_URL` and `STELLAR_API_KEY` are blockers for the IRC metrics integration. If they're not in `.env`, do not attempt to run or test the stellar integration path. File `needs-info` and note it.

---

## Stellar Integration Contract

The only thing korin.pink sends to stellar-api is raw IRC signals. Do not compute weights, scores, or rankings.

### Bridge → korin API (internal)

```
POST /irc/metrics
x-bridge-secret: $IRC_BRIDGE_SECRET
Content-Type: application/json

[
  {
    "stellarUserId": "string",
    "nick": "string",
    "presenceSeconds": 900,
    "messageCount": 42,
    "channels": ["#general", "#dev"],
    "lastSeen": "2026-06-14T12:00:00Z"
  }
]
```

### stellar-api → korin API (external pull)

```
GET /irc/metrics?flush=true
x-api-key: $STELLAR_PULL_KEY

→ { metrics: [...], ts: "ISO" }
```

`flush=true` clears the in-memory store. stellar-api owns the cadence.

### Nick → stellarId resolution

```
GET /irc/users/:nick/stellar-id   (korin API proxies to stellar-api)
x-bridge-secret: $IRC_BRIDGE_SECRET

→ { nick: "string", stellarId: "string | null" }
```

`stellarId` is `null` for an unlinked nick (not a 404), so the bridge branches on the
body; an upstream failure or missing config is a `502` (never `null`) so the bridge
retries rather than mislinks. Lets the bridge attribute a nick's metrics (ADR-0013).

Shipped in PR #38 — see `packages/api/src/routes/irc.ts`.

---

## Coding Rules (enforced, not suggested)

**TypeScript**
- `strict: true`. No `any`. No `@ts-ignore` without a comment explaining why.
- ESM only. File extensions in imports: `import { x } from './lib/drive.js'`
- Zod at every route boundary. Parse before calling lib functions.

**Fastify**
- One plugin export per route file: `export async function fooRoutes(app: FastifyInstance)`
- No Express. No Koa. No NestJS.

**Lib modules**
- Named async function exports only. No classes.
- No Fastify imports inside lib files.
- Throw descriptive errors on non-2xx or missing env.
- Read env vars at module load, throw immediately if required ones are absent.

**Environment**
- Never pass secrets as function arguments.
- Never `console.log` secrets, tokens, or user IDs.

**Ergo config**
- Do not change `force-nick-equals-account` — this is required for the nick→stellarUserId mapping.
- Do not disable `require-sasl` — all connections must authenticate.
- Password hashes only. Never store plaintext passwords in `ergo.yaml`.

---

## What You Must Never Do

- Implement `IRCScore` weighting or any scoring formula. stellar-api owns that.
- Push to `main` directly.
- Commit `.env`, `gcp-service-account.json`, or any `tls/*.pem` files.
- Add AWS infrastructure. AWS is descoped. See `korin-omnibus/docs/adr/002-deployment-targets.md`.
- Add GCP-specific constructs to `docker-compose.yml`. It must run on a $5 Hetzner box.
- Add Express, Axios, or `node-fetch` — use native `fetch` (Node 20+) or `undici`.
- Remove or weaken the `x-bridge-secret` / `x-api-key` auth on `/irc/metrics`. These are the only things protecting metric integrity.

---

## Branching and PR

```
branch: feat/irc-bridge-nick-cache
commit: feat(irc-bridge): add TTL-based nick→stellarId cache

PR title:  type(scope): description
PR body:   closes #N
           ## What changed
           ## Why
           ## How to test
```

Scopes: `api` `web` `irc` `irc-bridge` `infra` `docs`

Do not open a PR for work that cannot be verified locally. If you can't run `docker compose up` to confirm the change, say so in the PR body and label `ready-for-human`.

---

## Verification Checklist

Before opening a PR:

```bash
# types clean?
pnpm --filter @korin/api exec tsc --noEmit

# stack boots?
cd infra && docker compose up --build -d
docker compose ps        # all services should be Up
curl localhost:3000/health   # → {"status":"ok"}

# no secrets in staged files?
git diff --cached | grep -iE '(api_key|secret|password|token|credential)' && echo "STOP"
```
