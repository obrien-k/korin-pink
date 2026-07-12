# Changelog

## [0.3.0](https://github.com/obrien-k/korin-pink/compare/korin-pink-v0.2.0...korin-pink-v0.3.0) (2026-07-12)


### Added

* **api:** fully stub out api routes and libraries ([357e9e0](https://github.com/obrien-k/korin-pink/commit/357e9e0c7ee8c7dc3ee5d64dbd286ec6fb798cbb))
* **chat:** gamja web IRC client served at /chat/ ([#33](https://github.com/obrien-k/korin-pink/issues/33)) ([fe57ce2](https://github.com/obrien-k/korin-pink/commit/fe57ce2bea05620c2807be06dc8b075de6af639e))
* **ci:** deploy-vps manages the full stack + verifies the bridge login ([#57](https://github.com/obrien-k/korin-pink/issues/57)) ([#60](https://github.com/obrien-k/korin-pink/issues/60)) ([04f3873](https://github.com/obrien-k/korin-pink/commit/04f38731e5a14f4143a5bced48e82ab62e2b469d))
* configure docker local dev stack, integrate strict rss parser, and add caddy routing ([3733433](https://github.com/obrien-k/korin-pink/commit/37334338907118a9f7170a9f5503a64315824f9e))
* **deploy:** live manual-dispatch deploy + inject korin↔stellar secrets ([#17](https://github.com/obrien-k/korin-pink/issues/17)) ([#30](https://github.com/obrien-k/korin-pink/issues/30)) ([b5f3ea4](https://github.com/obrien-k/korin-pink/commit/b5f3ea45cd1a2e07ee6471e7879d6aef75d9e40d))
* **deploy:** public api.korin.pink front-door on the Vultr box ([#16](https://github.com/obrien-k/korin-pink/issues/16)) ([#27](https://github.com/obrien-k/korin-pink/issues/27)) ([3de5672](https://github.com/obrien-k/korin-pink/commit/3de5672529a4aaac32a12111fd4461de67b0bcb4))
* **harden:** Ergo login-throttling ([#19](https://github.com/obrien-k/korin-pink/issues/19)) + 2G swap on the 1GB box ([#24](https://github.com/obrien-k/korin-pink/issues/24)) ([235ad9b](https://github.com/obrien-k/korin-pink/commit/235ad9bd07394ec788b3f16fe3e463aec0b5d37b))
* **irc-bridge:** createBridge(deps) seam + end-to-end smoke ([#20](https://github.com/obrien-k/korin-pink/issues/20)) ([#40](https://github.com/obrien-k/korin-pink/issues/40)) ([7290b1b](https://github.com/obrien-k/korin-pink/commit/7290b1b402f133eeaad7c7898deab437caecf8cf))
* **irc-bridge:** per-channel message breakdown + pairwise nick-mentions ([#47](https://github.com/obrien-k/korin-pink/issues/47)) ([3236ecc](https://github.com/obrien-k/korin-pink/commit/3236ecc1b8199e5d72ba50a0146be1cb0aa75ddb)), closes [#42](https://github.com/obrien-k/korin-pink/issues/42)
* **irc:** relay nick verification to stellar (ADR-0015) ([#31](https://github.com/obrien-k/korin-pink/issues/31)) ([11cd9b9](https://github.com/obrien-k/korin-pink/commit/11cd9b9a2c684be200c77709437045df451c6922))
* **irc:** reserve SysOp + core channels, guard oper capabilities ([#11](https://github.com/obrien-k/korin-pink/issues/11)) ([89d2d23](https://github.com/obrien-k/korin-pink/commit/89d2d236e1f924632d449deed3ae624f3479b520))
* **irc:** resolve IRC nick → stellarId so metrics are account-attributed ([#38](https://github.com/obrien-k/korin-pink/issues/38)) ([463c86f](https://github.com/obrien-k/korin-pink/commit/463c86f99665b04536ebd702b7673cf35c62c81f))
* **ledger:** scaffold Go accounting service + ADR-004 ([#32](https://github.com/obrien-k/korin-pink/issues/32)) ([6c71691](https://github.com/obrien-k/korin-pink/commit/6c716910d5d6c2e22d0fb69ee1a07b07d81d72bf))
* **portal:** surface the web IRC client; drop unbuilt services ([be74845](https://github.com/obrien-k/korin-pink/commit/be748451a342d983743a2f4ff055719e1e2f9b55))
* **scaffold:** init korin-pink monorepo ([6e344e5](https://github.com/obrien-k/korin-pink/commit/6e344e5da01dac2dd9776d73377b79f92a56b4fb))
* **v0.1.1:** irc-bridge, metrics API, wiki repoint, nginx fix ([26ea5d0](https://github.com/obrien-k/korin-pink/commit/26ea5d084c2729ed56053444c9a95faa903a1e60))
* **web:** serve wiki at /wiki + publish-ready repo + fix Pages build ([#3](https://github.com/obrien-k/korin-pink/issues/3)) ([8e1e4d9](https://github.com/obrien-k/korin-pink/commit/8e1e4d9d806132cd9b1a72d2af20ab30239c8b5c))


### Fixed

* **harden:** correct three Ubuntu 24.04 boot-script bugs ([#9](https://github.com/obrien-k/korin-pink/issues/9)) ([f2458b4](https://github.com/obrien-k/korin-pink/commit/f2458b458a199a4459ba229588f62babcf4a6b03))
* **harden:** detect the public NIC at runtime, don't hardcode eth0 ([#29](https://github.com/obrien-k/korin-pink/issues/29)) ([55d500a](https://github.com/obrien-k/korin-pink/commit/55d500a8b594e22057f499464c15dffcd1e1d81e))
* **harden:** DOCKER-USER perimeter strangled container egress + web ingress ([#28](https://github.com/obrien-k/korin-pink/issues/28)) ([b7d7f86](https://github.com/obrien-k/korin-pink/commit/b7d7f86d73160ca1f9e04ad0948094bfbf823d0a))
* **harden:** make IRC_ENABLED actually gate the firewall + fail2ban jail ([#6](https://github.com/obrien-k/korin-pink/issues/6)) ([13ec168](https://github.com/obrien-k/korin-pink/commit/13ec1686874710726cfd314f6dcaa96d2f6a5e73))
* **harden:** match fail2ban filter to real Ergo 2.18 logs ([#19](https://github.com/obrien-k/korin-pink/issues/19)) ([#22](https://github.com/obrien-k/korin-pink/issues/22)) ([787e495](https://github.com/obrien-k/korin-pink/commit/787e4953dc9561aa18d98d2cb98f80cb813207b0))
* **infra:** connect irc-bridge over TLS via cert-hostname network alias ([#58](https://github.com/obrien-k/korin-pink/issues/58)) ([6f44dfa](https://github.com/obrien-k/korin-pink/commit/6f44dfabd12ea99eb2008e4045ac9438ab67b9dc))
* **infra:** make wiki service opt-in via compose profile ([#12](https://github.com/obrien-k/korin-pink/issues/12)) ([3301df5](https://github.com/obrien-k/korin-pink/commit/3301df561cda05d34ed15e1db356797b770d197f))
* **irc:** boot Ergo without secrets by disabling empty-password opers ([31e4724](https://github.com/obrien-k/korin-pink/commit/31e47245beffb866dba7a08b14fe1b25246d03bc))
* **irc:** launch our ergo.yaml in Docker, not stock Ergo ([#13](https://github.com/obrien-k/korin-pink/issues/13)) ([58f37c6](https://github.com/obrien-k/korin-pink/commit/58f37c6240a82efcf989d4dc8abf7d9dbfa90969))
* **irc:** make ergo.yaml actually boot + add real-binary boot test ([#10](https://github.com/obrien-k/korin-pink/issues/10)) ([32967bf](https://github.com/obrien-k/korin-pink/commit/32967bf2175dbdfbe2ff97b475aeb12881166579))
* **irc:** restore opers via box-local mounted config (no committed secrets) ([#35](https://github.com/obrien-k/korin-pink/issues/35)) ([017f0ed](https://github.com/obrien-k/korin-pink/commit/017f0ed849665476ee0dc1ca713c98531766b7ba))
* **stellar:** align integration to ADR-0013 contract (pull metrics, push announce) ([912553d](https://github.com/obrien-k/korin-pink/commit/912553d4164c1002235d7df827500e2d9bf8e974))
* **stellar:** align integration to ADR-0013 contract (pull metrics, push announce) ([e6ac686](https://github.com/obrien-k/korin-pink/commit/e6ac686d4342109809934aeef0a0d36d95e5f8f3))
* **wiki:** trim homepage features to IRC.KORIN.PINK/WIKI ([#8](https://github.com/obrien-k/korin-pink/issues/8)) ([4f66918](https://github.com/obrien-k/korin-pink/commit/4f6691801b323e9d7f95a4d473c4767e270a9794))


### Changed

* **api:** one shared-secret guard + one config seam ([#25](https://github.com/obrien-k/korin-pink/issues/25)) ([037b9fd](https://github.com/obrien-k/korin-pink/commit/037b9fdd7470a80396aefcbcb397fdb6beab6199))
* **web:** migrate the portal + wiki to Astro & Astro Starlight (ADR-005) — one `pnpm --filter @korin/web build` now produces a single `dist/` for the landing page (`/`), the Starlight wiki (`/wiki/*`), and gamja chat (`/chat/`), retiring the standalone Docusaurus container and the Caddy `/wiki/*` proxy. All `/wiki/`, `/irc/feed.xml`, and `/chat/` URLs are preserved. ([#50](https://github.com/obrien-k/korin-pink/issues/50))


### Docs

* add repository lamp-post ([74284c6](https://github.com/obrien-k/korin-pink/commit/74284c631fa2db46951f48bda3dfde2968507569))
* align IRC docs with shipped verify feature + adopt docs/adr/ ([#39](https://github.com/obrien-k/korin-pink/issues/39)) ([4539244](https://github.com/obrien-k/korin-pink/commit/4539244380060e8cf5f8c9bba0d5faec9586b352))
* **changelog:** consolidate the IRC deployment batch ([#9](https://github.com/obrien-k/korin-pink/issues/9)–[#14](https://github.com/obrien-k/korin-pink/issues/14)) ([#15](https://github.com/obrien-k/korin-pink/issues/15)) ([cf92b8a](https://github.com/obrien-k/korin-pink/commit/cf92b8a9a42ac24d27d86f4adbd4b6cb39c10b6b))
* **context:** prune shipped stellar merge step; fix footer CRS state + cap drift ([#49](https://github.com/obrien-k/korin-pink/issues/49)) ([e8e9c7a](https://github.com/obrien-k/korin-pink/commit/e8e9c7abc31bf669a374e23ef4ac043c2aaacf30))
* **deploy:** document IRC operator login (SASL) + first-run gotchas ([#56](https://github.com/obrien-k/korin-pink/issues/56)) ([afa993a](https://github.com/obrien-k/korin-pink/commit/afa993a266f680ed3f6ab2ebe8fb158d82483f15))
* **deploy:** fix cert key perms, certbot deploy-hook, genpasswd ([#14](https://github.com/obrien-k/korin-pink/issues/14)) ([cca09dc](https://github.com/obrien-k/korin-pink/commit/cca09dc21c49196c29743eb253650d6999bbf006))
* **env:** drop superseded IRC_* lines from .env.example ([#62](https://github.com/obrien-k/korin-pink/issues/62)) ([56a875a](https://github.com/obrien-k/korin-pink/commit/56a875a30c9da6cbcf3d873e89fda49244ea255c))
* **governance:** canonical-clone map + settle the IRC auth-model question ([#23](https://github.com/obrien-k/korin-pink/issues/23)) ([d0b46f6](https://github.com/obrien-k/korin-pink/commit/d0b46f60b6b8f9fd8b6987805c894fe9f820a807))
* **ledger:** state domain nomenclature positively; add Neutralpass ([#37](https://github.com/obrien-k/korin-pink/issues/37)) ([3db9c71](https://github.com/obrien-k/korin-pink/commit/3db9c71e851dc2d621df215928e9d60661ab66e1))
* **wiki:** Code Noobs Root + IRC as equal entry points; pink social card ([#43](https://github.com/obrien-k/korin-pink/issues/43)) ([c355851](https://github.com/obrien-k/korin-pink/commit/c355851c55c019253bd5a3b71b6b9c903a47439c))
* **wiki:** port lineage-legacy pages from wuu.bi + wire sidebar ([#36](https://github.com/obrien-k/korin-pink/issues/36)) ([cf5f8c3](https://github.com/obrien-k/korin-pink/commit/cf5f8c3fb3585e91875a003ba2026cbe742648a6))

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

[v0.2.0]: https://github.com/obrien-k/korin-pink/compare/v0.1.2...v0.2.0
[v0.1.2]: https://github.com/obrien-k/korin-pink/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/obrien-k/korin-pink/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/obrien-k/korin-pink/releases/tag/v0.1.0
