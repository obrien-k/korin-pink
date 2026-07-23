#!/usr/bin/env bash
#
# deploy.sh — bring up the korin.pink stack on the VPS.
#
# ONE command, run by both CI and humans. deploy.yml's vps target calls this
# after rendering .env; on the box you run it directly. That shared path is the
# point: a hand-run `docker compose up` that omits ERGO_CONF or the prod overlay
# silently produces a different stack (ergo boots the committed template whose
# opers have empty passwords; caddy binds 8082 with the dev Caddyfile).
#
#   ./infra/deploy.sh
#
# Does NOT render .env — CI owns that (secrets come from Actions), and on the box
# .env is already in place. See docs/deploy/vps.md §5b for the CI/manual boundary.
#
# Overridable via environment:
#   ERGO_CONF   path to the box-local ergo config   (default ./ergo.local.yaml)
#   API_DOMAIN  public API hostname                 (default api.korin.pink)

set -euo pipefail

cd "$(dirname "$0")"

ERGO_CONF="${ERGO_CONF:-./ergo.local.yaml}"
API_DOMAIN="${API_DOMAIN:-api.korin.pink}"

# First-run gate (#57): these box-provided files are documented ONE-TIME manual
# setup and never come from CI — oper hashes (vps.md §6a) and TLS certs
# (vps.md §4), plus the NickServ/ChanServ registrations in vps.md §6b, which are
# server-side state rather than files. Fail with a pointer, not half a deploy.
test -f "${ERGO_CONF}" || { echo "::error::missing ${ERGO_CONF} (oper hashes) — vps.md §6a"; exit 1; }
test -f tls/fullchain.pem -a -f tls/privkey.pem || { echo "::error::missing TLS certs in infra/tls/ — vps.md §4"; exit 1; }

# The account the bridge must SASL into, for the verification below. CI exports
# it; on the box it comes from the deploy-managed .env.
IRC_SASL_USER="${IRC_SASL_USER:-$(grep -E '^IRC_SASL_USER=' ../.env | cut -d= -f2- || true)}"
test -n "${IRC_SASL_USER}" || { echo "::error::IRC_SASL_USER unset and not found in .env"; exit 1; }

compose() {
  ERGO_CONF="${ERGO_CONF}" API_DOMAIN="${API_DOMAIN}" \
    docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"
}

# --remove-orphans clears containers whose service no longer exists in the
# compose file — the ledger and wiki services both went this way, and a stale
# container outliving its definition is not a state worth preserving.
compose up -d --build --remove-orphans ergo api irc-bridge caddy

# Recreate the bridge so THIS deploy's login is provable in the logs below; a
# surviving container would show no fresh login line. Costs one metrics flush
# window, which is acceptable for a deliberate deploy.
compose up -d --force-recreate irc-bridge

# Verify the healthy triplet in ergo's log, not merely "container up": the bridge
# must SASL into its account (vps.md §6b step 4) within 60s.
for _ in $(seq 1 12); do
  if compose logs --since 2m ergo | grep -q "logged into account : ${IRC_SASL_USER}"; then
    echo "bridge logged into ${IRC_SASL_USER} — deploy verified"
    compose ps
    exit 0
  fi
  sleep 5
done

echo "::error::bridge never logged into ${IRC_SASL_USER} — recent logs:"
compose logs --tail 30 irc-bridge ergo
exit 1
