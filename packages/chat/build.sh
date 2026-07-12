#!/usr/bin/env bash
# Build the gamja web IRC client into the static portal at /chat/.
#
# gamja (https://github.com/Libera-Chat/gamja) is built from source with Parcel
# and served as static files under the /chat/ sub-path of the korin.pink portal.
# It builds into the Astro app's public/chat so `astro build` ships it in dist/.
# One built bundle works in every environment; only config.json (loaded at
# runtime by gamja) differs:
#   - dev : server.url "/socket"            → Caddy reverse-proxies to Ergo's
#                                              internal ws listener (ergo:8098)
#   - prod: server.url wss://irc.korin.pink:8097 → direct to Ergo's TLS listener
#           (Cloudflare Pages is static and cannot proxy a WebSocket)
#
# Usage:
#   ./build.sh                 # prod config (default; Cloudflare Pages / CI)
#   CHAT_ENV=dev ./build.sh    # dev config (self-hosted Caddy stack)
#
# Supply chain: GAMJA_REF is PINNED to a reviewed release tag and the resolved
# commit is verified against GAMJA_SHA — a tag move or upstream compromise aborts
# the build. Bump both together after reviewing the new gamja release. npm install
# scripts are disabled (--ignore-scripts) so a transitive postinstall can't run
# arbitrary code in CI.
set -euo pipefail

GAMJA_REPO="${GAMJA_REPO:-https://github.com/Libera-Chat/gamja.git}"
GAMJA_REF="${GAMJA_REF:-v1.0.0-beta.8}"                               # pinned tag
GAMJA_SHA="${GAMJA_SHA:-fd63c169ed3dd3daa010dcc97413cfd6793ba4f6}"   # expected commit
CHAT_ENV="${CHAT_ENV:-prod}"

here="$(cd "$(dirname "$0")" && pwd)"
# Output into the Astro app's public/ so `astro build` copies it to dist/chat
# (and `astro dev`/`preview` serve it too). git-ignored; built fresh each deploy.
portal_chat="$here/../web/public/chat"
work="$here/.gamja-src"

if [ ! -f "$here/config.$CHAT_ENV.json" ]; then
  echo "error: unknown CHAT_ENV='$CHAT_ENV' (no config.$CHAT_ENV.json)" >&2
  exit 1
fi

echo "==> Cloning gamja ($GAMJA_REF) from $GAMJA_REPO"
rm -rf "$work"
# --branch works for a tag/branch; fall back to a full clone if GAMJA_REF is a SHA.
git clone --depth 1 --branch "$GAMJA_REF" "$GAMJA_REPO" "$work" 2>/dev/null \
  || { git clone "$GAMJA_REPO" "$work" && git -C "$work" checkout "$GAMJA_REF"; }

resolved="$(git -C "$work" rev-parse HEAD)"
echo "==> gamja resolved to commit: $resolved"
if [ -n "$GAMJA_SHA" ] && [ "$resolved" != "$GAMJA_SHA" ]; then
  echo "error: gamja commit $resolved != expected $GAMJA_SHA — refusing to build." >&2
  echo "       (bump GAMJA_REF + GAMJA_SHA together after reviewing the new release)" >&2
  exit 1
fi

echo "==> Installing + building (Parcel, public-url /chat/, install scripts disabled)"
( cd "$work" && npm ci --ignore-scripts && npm run build -- --public-url /chat/ )

echo "==> Publishing build → $portal_chat"
rm -rf "$portal_chat"
mkdir -p "$portal_chat"
cp -r "$work/dist/." "$portal_chat/"

echo "==> Writing config.json (env=$CHAT_ENV)"
cp "$here/config.$CHAT_ENV.json" "$portal_chat/config.json"

echo "==> Done: gamja built into packages/web/public/chat (served at /chat/), config=$CHAT_ENV"
