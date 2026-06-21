# ADR-002: Deployment Targets

**Status:** Accepted
**Date:** 2026-06-14
**Repos:** obrien-k/korin-pink

---

## Context

korin.pink must run somewhere persistent (Ergo needs a long-lived TCP process; see
ADR-001) while staying portable enough for community members to self-host. We need
to fix which targets are first-class and which are explicitly out of scope, so the
`infra/` baseline and CI stay deployment-agnostic rather than drifting toward one
cloud's primitives.

---

## Decision

Support three targets, descope a fourth:

| Target    | Status    | Notes                                   |
| --------- | --------- | --------------------------------------- |
| GCP       | default   | Cloud Run (API) + Compute Engine (Ergo) + Drive |
| VPS       | supported | OVH, Hetzner, bare metal + Caddy        |
| Self-host | supported | Docker Compose + mkcert/ngrok           |
| AWS       | descoped  | Not maintained; revisit only with a new ADR |

`infra/docker-compose.yml` is the universal baseline and must stay free of
cloud-specific constructs. GCP-only wiring lives in `infra/gcp/`.

---

## Rationale

- **GCP default** because korin.pink already depends on Google Workspace (Gmail,
  Drive, Gemini) — keeping infra in the same cloud minimizes credential surface.
- **VPS / self-host first-class** because the community may not want a Google
  dependency; Caddy + Docker Compose covers this with auto-TLS.
- **AWS descoped** to avoid maintaining a third cloud's IaC for no current user.
  Ergo's persistent-TCP requirement already rules out the serverless primitives
  (Lambda) that would be AWS's main draw.

---

## Consequences

- `docker-compose.yml` must not gain GCP-only services. Enforced by review (see
  `docs/CLAUDE.md` → "What Not To Do").
- Adding AWS later requires a superseding ADR, not an ad-hoc `infra/aws/` drop-in.
