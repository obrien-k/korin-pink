# Shared secrets (korin ↔ stellar)

korin.pink and `orphic-inc/stellar-api` authenticate each other with **two**
shared secrets. They are provisioned **programmatically** — stored as GitHub
Actions secrets and injected into the box `.env` by the `deploy-vps` job
(`infra/deploy.yml`). **Never hand-edit `/opt/korin.pink/.env`** — it is rendered
on every deploy and your edits are overwritten.

## Ownership: the guarding side mints

A shared key is owned by the side that **validates** it — not whoever sets it
first. Each side mints the key for the endpoint it guards and the other side
holds a copy.

| Key | Call | Header | Guarded by → **mints** | Other side → **copies** |
|-----|------|--------|------------------------|--------------------------|
| **S1** | metrics pull + announce push (stellar → korin) | `x-pull-key` | **korin** (`STELLAR_PULL_KEY`) | stellar (`KORIN_PULL_KEY`) |
| **S2** | nick lookup / link / reputation (korin → stellar) | `Authorization: Bearer` | **stellar** (`STELLAR_SERVICE_KEY`) | korin (`STELLAR_API_KEY`) |

> Same value, two names per side. korin's outbound Bearer var is
> `STELLAR_API_KEY`; it must equal stellar's `STELLAR_SERVICE_KEY`. The pull key
> is `STELLAR_PULL_KEY` on korin and `KORIN_PULL_KEY` on stellar.

## Mint + set (run once; rotate by re-running)

```bash
S1=$(openssl rand -hex 32)   # pull key   — korin owns
S2=$(openssl rand -hex 32)   # service key — stellar owns

# korin-pink (this repo): korin reads S1 to validate; presents S2 outbound.
gh secret set STELLAR_PULL_KEY    -R obrien-k/korin-pink   -b"$S1"
gh secret set STELLAR_SERVICE_KEY -R obrien-k/korin-pink   -b"$S2"

# stellar-api: stellar presents S1 outbound; reads S2 to validate.
gh secret set KORIN_PULL_KEY      -R orphic-inc/stellar-api -b"$S1"
gh secret set STELLAR_SERVICE_KEY -R orphic-inc/stellar-api -b"$S2"
```

korin-internal secrets (not shared with stellar) also set on korin-pink:

```bash
gh secret set IRC_BRIDGE_SECRET -R obrien-k/korin-pink -b"$(openssl rand -hex 32)"
gh secret set IRC_SASL_USER     -R obrien-k/korin-pink -b'stellar-bridge'
gh secret set IRC_SASL_PASS     -R obrien-k/korin-pink -b'<bridge Ergo account password>'
```

Non-secret config as repo **variables** (not secrets):

```bash
gh variable set DEPLOY_TARGET   -R obrien-k/korin-pink -b'vps'
gh variable set API_DOMAIN      -R obrien-k/korin-pink -b'api.korin.pink'
gh variable set STELLAR_API_URL -R obrien-k/korin-pink -b'https://<stellar-api-public-url>'
```

The stellar side also needs `KORIN_API_URL=https://api.korin.pink` in its deploy
env (it points the metrics-pull / announce-push jobs at korin).

## Running a deploy

The workflow (`.github/workflows/deploy.yml`) is **manual-dispatch only** — it
never fires on push. Once the secrets/vars above are set:

```bash
gh workflow run deploy.yml -R obrien-k/korin-pink -f target=vps
```

or **Actions → deploy → Run workflow → target: vps**. It renders the box `.env`
from the secrets and brings the API up behind Caddy.

## Verify (after both pipelines have deployed)

```bash
# S1 — from the stellar box (or anywhere with the value):
curl -fsS -H "x-pull-key: $S1" https://api.korin.pink/irc/metrics    # → 200 JSON
curl -i https://api.korin.pink/irc/metrics                           # → 401 (no key) proves fail-closed
```

S2 is wired-for-later: no korin route calls stellar yet, so it won't be exercised
until that path lands — but set it now so the deploy is complete.

## Rotation

Re-run the `openssl` + `gh secret set` block with fresh values on **both** repos,
then redeploy both. Because the box `.env` is deploy-rendered, a korin redeploy
picks up the new value with no manual file edits.
