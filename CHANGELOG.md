# Changelog

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
