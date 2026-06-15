# Changelog

## [Unreleased]

### Changed
- `packages/api/src/lib/stellar.ts`: aligned the stellar-api client to the
  ADR-0013 integration contract — removed the orphaned metrics **push** path
  (`flushIRCMetrics` → `POST /reputation/irc-metrics`; metrics are pull-only),
  and fixed the korin→stellar calls to their real paths/shapes
  (`/api/users/by-irc-nick/:nick`, `PUT /api/users/:id/irc-nick` `{ ircNick }`,
  `GET /api/users/:id/reputation`).
- `packages/api`: `POST /irc/announce` now requires `x-pull-key` (stellar
  presents the shared pull key when pushing release RSS).
- Docs (`home.md`, `domain.md`, `CLAUDE.md`, `CONTEXT.md`): pinned the
  bidirectional contract (pull metrics / push announce / korin→stellar service
  calls); corrected the payload shape and stale `stellar ADR-0005` references
  (now stellar-api ADR-0013).

## [v0.1.1] - 2026-06-14

### Added
- `packages/irc-bridge`: full IRC bridge daemon — TLS/SASL connect to Ergo, track join/part/quit/nick/privmsg per user, flush `{ users: UserMetrics[] }` to `POST /irc/metrics` every 60s (`FLUSH_INTERVAL_MS`)
- `packages/api`: `POST /irc/metrics` (bridge push, `x-bridge-secret`) + `GET /irc/metrics` (stellar-api pull, `x-pull-key`); in-process metrics store, no DB dependency
- `packages/api`: `POST /irc/announce` — RSS/podcast feed → IRC line renderer (strict podcast parser + minimal platform format)
- Wiki: IRC community wiki repointed to `korin.pink`; IRC section added (overview, connecting guide, channel directory, etiquette, IRCScore formula); Docusaurus config updated (`url`, `baseUrl`, `editUrl`, dual sidebar)
- `docs/CONTEXT.md`: open question #6 — irc-bridge pairwise mention tracking needed for stellar-api's IRC Mutual-Mention × Friends negative CRS vector (PRD-03)

### Changed
- All package versions aligned to `0.1.1` (root was `1.0.0` pnpm-init default, api was `0.0.1`, irc-bridge was `0.1.0`)
- `korin-omnibus/wiki` stubbed as read-only redirect; canonical wiki location is now `korin-pink/wiki`

### Fixed
- nginx `proxy_pass` trailing slash stripped `/api/` prefix before forwarding to Express — removed trailing slash so full URI is preserved (`proxy.nginx.conf` + `proxy-tls.nginx.conf` in stellar-compose)

---

## [v0.1.0] - 2026-06-14
### Added
- Scaffolded the `obrien-k/korin-pink` repository for the new Stellar IRC infrastructure layer and CRS health monitor.
- Transitioned focus to `korin.pink` due to `kyleo.io` downtime and `korin.black` operational costs.
- Migrated core documentation and configuration from `korin-omnibus`'s `korin-pink` branch.
- Included the "Japanese wiki addition" (from omnibus commit `cc909b6`) into the new wiki directory.
- Defined initial `AGENTS.md` specifying the architecture, commands, and rules for the monorepo.
- Scaffolded `packages/api` to implement the LinkHealth-Gated Ratio Relief (ADR 0006) metrics boundary for `POST /irc/metrics`.

### Note
`korin-omnibus` remains the private historical repository for overall schema/domain planning, but `korin-pink` serves as the public implementation monorepo.
