# AGENTS.md

Repository workflow, architecture, and coding patterns for `obrien-k/korin-omnibus` and the `korin.{color}` scheme.

---

## Architecture Overview

### The Korin Scheme

`korin.{color}` is a naming convention for community infrastructure deployments that serve the Stellar ecosystem. Each deployment is a self-contained stack exposing services under its domain.

```
korin.pink     ← active (IRC, files, wiki, mail, AI)
korin.{*}      ← reserved for future deployments
```

Each instance follows the same package layout. Shared conventions live here in `korin-omnibus`.

### korin.pink Stack

```
  [browser / IRC client]
        │
        ▼
  [Caddy — TLS, reverse proxy]
   ┌─────┴──────────────────────┐
   │   web (static portal)      │
   │   api (Fastify)            │
   │     ├── /files  → Drive    │
   │     ├── /wiki   → Drive    │
   │     ├── /ai     → Gemini   │
   │     ├── /mail   → Gmail    │
   │     └── /irc    → metrics  │
   └────────────────────────────┘
        │
        ▼
  [Ergo IRCd — port 6697 TLS]
        │
        ▼
  [irc-bridge — Node.js bot]
        │  (POST /irc/metrics every 15 min)
        ▼
  [korin API /irc/metrics store]
        │
        ▼  (GET /irc/metrics?flush=true)
  [stellar-api — CRS computation]
```

### Stellar CRS Integration

korin.pink is Stellar's IRC infrastructure layer. The IRC bridge accumulates signals and flushes them to `stellar-api` which computes:

```
CommunityValueIndex = RatioScore + CommunityReputationScore + IRCScore + FeedScore + ...

IRCScore = activity * consistency * channelQuality   // stellar-api owns this formula
```

Korin emits raw signals only:

| Signal           | Source                        |
| ---------------- | ----------------------------- |
| presenceSeconds  | Time online since last flush  |
| messageCount     | Messages sent across channels |
| channelCount     | Unique channels participated  |

---

## Repository Structure

### obrien-k/korin-omnibus (this repo)

Documentation, wiki, ADRs, and cross-repo coordination for the Korin scheme.
No runnable code. Issues here are omnibus-level: naming, docs, cross-repo decisions.

### obrien-k/korin-pink

Implementation monorepo. All runnable code lives here.
Issues here are implementation-level: bugs, features, infra.

---

## Branching

| Prefix    | Use                                      |
| --------- | ---------------------------------------- |
| `feat/`   | New capability                           |
| `fix/`    | Bug fix                                  |
| `docs/`   | Documentation only                       |
| `chore/`  | Tooling, deps, config                    |
| `adr/`    | Architectural decision record            |

Branch from `main`. No direct pushes to `main`.

---

## PR Convention

Title format: `type(scope): description`

Scopes:
| Scope        | Target                        |
| ------------ | ----------------------------- |
| `api`        | packages/api                  |
| `web`        | packages/web                  |
| `irc`        | packages/irc (Ergo config)    |
| `irc-bridge` | packages/irc-bridge           |
| `infra`      | infra/ (docker, terraform)    |
| `docs`       | Any documentation             |
| `omnibus`    | Cross-repo / scheme-level     |

Examples:
```
feat(irc-bridge): add nick→stellarId cache with TTL
fix(api): handle Drive upload timeout gracefully
docs(omnibus): add korin.purple placeholder ADR
chore(infra): pin ergo to v2.14.1
```

---

## Issue Lifecycle

See `docs/agents/issue-tracker.md` for full workflow.

Quick reference:
1. New issues land as `needs-triage`
2. Agent reviews: add scope label + `ready-for-agent` or `ready-for-human`
3. Work begins: move to `in-progress`
4. PR opened: link issue, label `ready-for-human` for review
5. Merged: issue closes automatically via `closes #N` in PR body

---

## Coding Patterns

### API Routes (Fastify)

Every route file exports a single async plugin function:
```typescript
export async function fooRoutes(app: FastifyInstance) {
  app.get('/bar', async (req, reply) => { ... })
}
```

Validate all input with Zod before touching any external service. Parse at the route boundary, not inside lib functions.

### Lib Modules

Each lib module (`drive.ts`, `gemini.ts`, `stellar.ts`, etc.) is a thin client over one external service. It should:
- Export named async functions only (no classes)
- Throw descriptive errors on non-2xx / missing env
- Have zero Fastify dependencies

### irc-bridge

The bridge holds IRC session state in memory. It is intentionally stateless between restarts — metrics not yet flushed are lost on crash. This is acceptable for v0.x. A persistent store is tracked in `docs/adr/003-irc-bridge-state.md`.

### Environment Variables

Read once at module load. Throw immediately if required vars are missing:
```typescript
const SECRET = process.env.MY_SECRET
if (!SECRET) throw new Error('MY_SECRET is required')
```

Never pass env vars as function arguments through the call stack.

---

## Deployment

Default: GCP (Cloud Run + Compute Engine + Workspace).
Docs are deployment-agnostic. Every deployment guide ships a Docker Compose baseline.

| Target     | Guide                          | Status   |
| ---------- | ------------------------------ | -------- |
| Self-host  | docs/deploy/self-host.md       | ✓        |
| VPS        | docs/deploy/vps.md             | ✓        |
| GCP        | docs/deploy/gcp.md             | ✓        |
| AWS        | descoped                       | —        |

Ergo requires persistent TCP. It cannot run on serverless platforms.

---

## Architectural Decisions

See `docs/adr/` for all records. Open an `adr/` branch to propose a new decision.

| ADR | Decision                                      |
| --- | --------------------------------------------- |
| 001 | Ergo as the IRC daemon                        |
| 002 | Deployment-agnostic with GCP as default       |
| 003 | irc-bridge as a separate stateless service    |
