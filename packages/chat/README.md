# @korin/chat — gamja web IRC client

A web view for the Ergo IRC daemon (`packages/irc`), built from
[gamja](https://github.com/Libera-Chat/gamja) and served as static files under
the **`/chat/`** sub-path of the korin.pink portal — the same pattern the
Docusaurus wiki uses for `/wiki/`.

There is **no runtime container**: `build.sh` compiles gamja into
`packages/web/chat/`, which the front-door Caddy serves from `/srv/web` (dev) and
Cloudflare Pages serves from the portal bundle (prod). `packages/web/chat/` is a
build artifact and is git-ignored, like `packages/web/wiki/`.

## Build

```bash
cd packages/chat
./build.sh              # prod config (default) — used by Cloudflare Pages / CI
CHAT_ENV=dev ./build.sh # dev config — for the self-hosted Caddy stack
```

`build.sh` clones gamja at `GAMJA_REF` (default `master`), runs the Parcel build
with `--public-url /chat/`, copies `dist/` into `packages/web/chat/`, and drops
the env-specific `config.json`. It prints the resolved gamja commit SHA — **pin
`GAMJA_REF` to that SHA** for reproducible builds.

## How it connects to Ergo

gamja loads `config.json` at runtime, so one built bundle serves every
environment; only `config.json` changes (`server.url`):

| Env  | `server.url`                     | Path to Ergo |
| ---- | -------------------------------- | ------------ |
| dev  | `/socket`                        | Caddy reverse-proxies `/socket` → `ergo:8098` (internal plain-ws listener); edge TLS terminated by Caddy |
| prod | `wss://irc.korin.pink:8097`      | Direct to Ergo's TLS WebSocket listener (already firewall-exposed); Cloudflare Pages can't proxy a WebSocket |

Ergo must permit the browser Origin: `server.websockets.allowed-origins` in
`packages/irc/ergo.yaml` lists the portal origins.

### Prod prerequisites (DNS / TLS)

- `irc.korin.pink` must resolve to the Ergo box and be **DNS-only (grey-cloud)** on
  Cloudflare — `:8097` is a non-standard port the CF proxy won't carry.
- Ergo's `:8097` TLS cert (`fullchain.pem`) must be valid for `irc.korin.pink`.

## Config keys (gamja)

`server.url`, `server.autojoin` (string or array), `server.auth`
(`mandatory|optional|disabled|external|oauth2`), `server.autoconnect`. See gamja's
`doc/config-file.md`. SASL/account login ties into Ergo's required account
registration and the verified-nick link (stellar-api ADR-0015).
