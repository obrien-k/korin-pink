# ADR-001: Ergo as the IRC Daemon

**Status:** Accepted
**Date:** 2026-06-14
**Repos:** obrien-k/korin-pink

---

## Context

korin.pink requires an IRC daemon for the `irc.korin.pink` server. Stellar's PRD (v0.0.4) defines IRC presence as a future CRS signal, requiring that the daemon be instrumented for activity tracking. The daemon must support TLS, SASL authentication (for Stellar credential bridging), message history, and persistent accounts.

Candidates evaluated:

| Daemon        | Language | IRCv3 | SASL | History | Notes                          |
| ------------- | -------- | ----- | ---- | ------- | ------------------------------ |
| Ergo          | Go       | ✓     | ✓    | ✓       | Single binary, modern, active  |
| UnrealIRCd    | C        | ✓     | ✓    | partial | Complex config, heavy          |
| InspIRCd      | C++      | ✓     | ✓    | module  | Modular but more ops overhead  |
| ngIRCd        | C        | partial| ✓   | ✗       | Minimal, too limited           |

---

## Decision

**Use Ergo.**

---

## Rationale

- **Single binary.** No separate services, no Postgres dependency at runtime (uses embedded Buntdb). Fits the minimalist deployment philosophy.
- **IRCv3.** Native support for `account-notify`, `SASL`, `MONITOR`, `labeled-response` — all needed for the irc-bridge's activity tracking.
- **Go.** Consistent with the Stellar ecosystem's Go services. Simple to containerize.
- **Active development.** Maintained, security-patched, and well-documented.
- **SASL PLAIN.** Allows the irc-bridge to bridge Stellar account credentials to IRC auth without a separate identity service in v0.x.

---

## Consequences

- Metrics extraction relies on the irc-bridge bot connecting as an operator. Ergo stable does not expose a REST API. This is acceptable; see ADR-003.
- If the community grows significantly (>10k concurrent users), Buntdb may need to be replaced with Postgres. Ergo supports this migration path.
- Ergo requires persistent TCP. It cannot run on Cloud Run or Lambda. A Compute Engine instance (GCP) or VPS is required.
