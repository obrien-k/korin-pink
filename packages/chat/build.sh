#!/usr/bin/env bash
# Build the gamja web IRC client into the static portal at /chat/.
#
# gamja (https://github.com/Libera-Chat/gamja) is built from source with Parcel
# and served as static files under the /chat/ sub-path of the korin.pink portal —
# mirroring how the Docusaurus wiki builds into /wiki/. One built bundle works in
# every environment; only config.json (loaded at runtime by gamja) differs:
#   - dev : server.url "/socket"            → Caddy reverse-proxies to Ergo's
#                                              internal ws listener (ergo:8098)
#   - prod: server.url wss://irc.korin.pink:8097 → direct to Ergo's TLS listener
#           (Cloudflare Pages is static and cannot proxy a WebSocket)
#
# Usage:
#   ./build.sh                 # prod config (default; Cloudflare Pages / CI)
#   CHAT_ENV=dev ./build.sh    # dev config (self-hosted Caddy stack)
#
# Reproducibility: pin GAMJA_REF to a commit SHA. The script prints the resolved
# SHA after cloning so you can pin it here / via the environment.
set -euo pipefail

GAMJA_REPO="${GAMJA_REPO:-https://github.com/Libera-Chat/gamja.git}"
GAMJA_REF="${GAMJA_REF:-master}"   # TODO: pin to the SHA printed below
CHAT_ENV="${CHAT_ENV:-prod}"

here="$(cd "$(dirname "$0")" && pwd)"
portal_chat="$here/../web/chat"
work="$here/.gamja-src"

if [ ! -f "$here/config.$CHAT_ENV.json" ]; then
  echo "error: unknown CHAT_ENV='$CHAT_ENV' (no config.$CHAT_ENV.json)" >&2
  exit 1
fi

echo "==> Cloning gamja ($GAMJA_REF) from $GAMJA_REPO"
rm -rf "$work"
# --branch works for a branch/tag; fall back to a full clone if GAMJA_REF is a SHA.
git clone --depth 1 --branch "$GAMJA_REF" "$GAMJA_REPO" "$work" 2>/dev/null \
  || { git clone "$GAMJA_REPO" "$work" && git -C "$work" checkout "$GAMJA_REF"; }
echo "==> gamja resolved to commit: $(git -C "$work" rev-parse HEAD)"

echo "==> Installing + building (Parcel, public-url /chat/)"
( cd "$work" && npm ci && npm run build -- --public-url /chat/ )

echo "==> Publishing build → $portal_chat"
rm -rf "$portal_chat"
mkdir -p "$portal_chat"
cp -r "$work/dist/." "$portal_chat/"

echo "==> Writing config.json (env=$CHAT_ENV)"
cp "$here/config.$CHAT_ENV.json" "$portal_chat/config.json"

echo "==> Done: gamja built into packages/web/chat (served at /chat/), config=$CHAT_ENV"
