# Changelog

## [Unreleased]

## [v0.2.0] - 2026-06-21

### Added
- **Public deploy path to the Vultr box**: the `api.korin.pink` front-door fronted by
  Caddy (#16, #27), plus a manual-dispatch GitHub Actions deploy that renders the box
  `.env` from secrets and injects the korin↔stellar shared keys (#17, #30).
- **`packages/ledger`**: scaffolded the Go hot-path accounting service (ADR-004) —
  internal-only on the korin network, flushing summaries to stellar-api as the system
  of record (#32).
- **`packages/chat`**: the gamja web IRC client served at `/chat/`, surfaced from the
  portal (#33, #34).
- Verified IRC nick relay (stellar-api ADR-0015; korin tail of stellar #163, korin
  PR #31). A member proves nick ownership by sending `!verify <code>` privately to
  the bridge bot — the bridge relays it through korin's new `POST /irc/verify`
  (`x-bridge-secret`), which calls `stellar.verifyNick(nick, code)` →
  stellar-api `POST /api/users/irc-nick/verify`. Verification is *not* SASL; it
  rests on Ergo's `force-nick-equals-account`. Covers `packages/api/src/routes/irc.ts`,
  `packages/api/src/lib/stellar.ts`, `packages/irc-bridge/src/{verify,index}.ts`,
  the `ergo.yaml` ADR-0015 note, and tests.
- **nick → stellarId resolution** (ADR-0013): the bridge resolves and caches each
  nick's Stellar account via korin's new `GET /irc/users/:nick/stellar-id`
  (`x-bridge-secret`) so flushed metrics are account-attributed — a miss flushes raw
  activity, an error retries rather than mislinks (#38).
- **`createBridge(deps)` seam + end-to-end smoke** (#20, #40): extracted the bridge's
  accumulator/handlers/flush/reconnect behind an injectable factory (mirroring korin's
  `buildServer`) with deterministic unit tests, plus an on-demand `npm run smoke` that
  boots Ergo + api + bridge and asserts a populated `GET /irc/metrics`. Surfaced and
  fixed two `irc-framework` v4 watchpoints: `WHO * %nuha` emitted no `wholist` (now
  seeds via `who('*')`, real channels only) and `auto_reconnect` raced the manual
  reconnect (now a single guarded path).
- Wiki: ported the lineage-legacy pages from `wuu.bi` and wired the sidebar (#36).

### Changed
- Docs (`CONTEXT.md`, `CLAUDE.md`, `domain.md`, `adr/001`): removed the superseded
  "self-reported nick / no verification" and delegated-SASL-credential claims to
  match the ADR-0015 verified-nick reality. Adopted `docs/adr/` in-repo and added
  the previously-dangling `002-deployment-targets` and `003-irc-bridge-state` ADR
  stubs that the docs already cited. Re-scoped `CLAUDE.md` from korin-omnibus to
  korin-pink (#39).
- `packages/ledger` docs: domain nomenclature stated positively; added **Neutralpass**
  to the ledger vocabulary (#37).
- Dropped unbuilt placeholder services from the portal/compose so only shipped
  surfaces are exposed (#34).

### Fixed
- `packages/harden`: the `DOCKER-USER` perimeter was strangling container egress and
  web ingress — corrected the chain so containers reach the network and ingress isn't
  blocked (#28); the firewall now detects the public NIC at runtime instead of
  hardcoding `eth0` (#29).
- `packages/irc`: Ergo wouldn't boot with the committed empty-password opers —
  disabled them for a clean boot (#34), then restored real opers via a box-local
  mounted config so no secrets are committed (#35).

## [v0.1.2] - 2026-06-16

### Added
- `packages/irc/ergo.yaml`: reserved the core community channels — `operator-only`
  channel registration plus `korin-admin` (human SysOp) and `stellar-bridge`
  (bridge bot) oper accounts on capability-scoped oper-classes, so
  `#announce`/`#stellar`/`#korin` can't be squatted before the SysOp claims them
  (#11).
- `packages/irc/test`: config + oper-policy tests (oper-class capability
  vocabulary, dangling-class refs, the operator-only registration gate), a
  real-binary Ergo boot test against the pinned image, and a Dockerfile
  launch-invariant test (#10, #11, #13).
- `infra/docker-compose.yml`: the Docusaurus `wiki` service is now opt-in behind
  a `wiki` compose profile — default `docker compose up` skips the build (which
  OOMs a 1 GB VPS; the wiki is served from Cloudflare Pages). `caddy`'s wiki
  dependency is `required: false`, so it still starts with the profile off
  (`/wiki/*` 502s, as expected) (#12).
- `docs/GOVERNANCE.md`: canonical-clone map (which clone is authoritative for
  what) plus the settled IRC auth-model decision — native Ergo accounts per
  ADR-0013; `.env.example` and `packages/irc/ergo.yaml` updated to match (#23).
- `packages/harden`: Ergo login-throttling to blunt brute-force connection
  attempts (#19), plus a 2 GB swapfile provisioned by `infra/vultr-startup.sh`
  for the 1 GB VPS (`packages/harden/src/startup.ts` + tests) (#24).

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
- `packages/api`: consolidated to a single shared-secret auth guard
  (`src/lib/auth.ts`) and one config seam (`src/config.ts`) — `index.ts` and
  `routes/irc.ts` now read auth + config from one place instead of inline env
  reads (`test/config-and-auth.test.ts`) (#25).

### Fixed
- `packages/irc` (Docker): the Ergo image now actually launches `ergo.yaml`.
  The base `ghcr.io/ergochat/ergo` ENTRYPOINT wrapper (`/ircd-bin/run.sh`) booted
  *stock* Ergo — default `ircd.yaml`, a generated `admin` oper, self-signed certs
  — and swallowed our plain `CMD`, so none of our config loaded. Override the
  wrapper and invoke `ergo run --conf /etc/ergo.yaml` directly (#13).
- `packages/harden`: corrected three Ubuntu 24.04 boot-script bugs — dropped
  `iptables-persistent`/`netfilter-persistent` (ufw `Breaks` them on noble) for a
  `korin-docker-user.service` systemd oneshot that replays the `DOCKER-USER` chain
  after Docker recreates it each boot; write an sshd drop-in
  (`00-korin-harden.conf`) so password-auth-off outranks cloud-init; delete the
  default world-open `22/tcp` ufw rule (#9).
- `packages/irc/ergo.yaml`: config corrections so it boots cleanly in the pinned
  Ergo image (#10).
- Docs (`docs/deploy/vps.md`, `self-host.md`): copy **real** cert files into
  `infra/tls` (symlinks into `/etc/letsencrypt` dangle inside the container),
  issue the cert with a single `certbot certonly` + renewal deploy-hook, keep the
  private key at `600`, bypass the image wrapper for `genpasswd`, and document the
  `--profile wiki` opt-in (#13, #14).
- `packages/harden`: fail2ban filter now matches the **real** Ergo 2.18 log
  lines — the prior regex never matched, so the jail never actually banned;
  `infra/fail2ban/ergo.conf` and `infra/vultr-startup.sh` corrected
  (`packages/harden/src/fail2ban.ts` + tests) (#19, #22).

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

[Unreleased]: https://github.com/obrien-k/korin-pink/compare/v0.2.0...HEAD
[v0.2.0]: https://github.com/obrien-k/korin-pink/compare/v0.1.2...v0.2.0
[v0.1.2]: https://github.com/obrien-k/korin-pink/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/obrien-k/korin-pink/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/obrien-k/korin-pink/releases/tag/v0.1.0
