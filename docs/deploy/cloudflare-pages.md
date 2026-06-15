# Deploy: Cloudflare Pages (static web portal)

This is the fastest path to getting **korin.pink** online. It publishes the
static portal in `packages/web/` to Cloudflare Pages and points your existing
Cloudflare DNS at it. The IRC/API/Ergo backend is a separate, later step
(it will live on a subdomain such as `api.korin.pink` / `irc.korin.pink`).

What's already wired in this repo:
- `packages/web/` — the static portal (`index.html`, `styles.css`, `feed.xml`,
  `main.js`).
- `wiki/` — the Docusaurus wiki (`baseUrl: /wiki/`). The build command below
  compiles it into `packages/web/wiki/` so the portal and wiki ship as one
  bundle and `korin.pink/wiki/` works — matching the self-hosted Caddy routing.
- `packages/web/_redirects` — maps `/irc/feed.xml` → `/feed.xml` on Pages.
- `.github/workflows/deploy-web.yml` — optional GitHub Actions deploy (builds
  the wiki, then publishes), dormant until you set `DEPLOY_WEB=true` (Option B).

You only need **one** of the two options below.

---

## Step 0 — Make the repo public

Required for Cloudflare's Git integration (Option A) and generally to "publish"
the project.

1. GitHub → `obrien-k/korin-pink` → **Settings** → **General** →
   **Danger Zone** → **Change repository visibility** → **Public**.
2. Confirm there are no secrets in history. This repo currently has none
   committed (verified: no `.env`, keys, or service-account files; the Ergo
   oper password in `packages/irc/ergo.yaml` is an empty `TODO`). The previously
   committed `node_modules/` has been removed from tracking.

> If you'd rather keep the repo private, skip to Option B and grant the
> Cloudflare GitHub App access to the private repo, **or** use the
> `wrangler` workflow which doesn't require Cloudflare to read the repo.

---

## Option A — Cloudflare Pages native Git integration (recommended, no secrets)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorize the Cloudflare GitHub App and select `obrien-k/korin-pink`.
3. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** **None** (the portal is hand-built static HTML; we
     supply our own build command for the wiki, so there's nothing to detect)
   - **Build command:**
     ```
     cd wiki && npm ci && npm run build && rm -rf ../packages/web/wiki && cp -r build ../packages/web/wiki
     ```
   - **Build output directory:** `packages/web`
4. **Save and Deploy.** Cloudflare builds a `*.pages.dev` preview URL. Confirm
   both the portal (`/`) and the wiki (`/wiki/`) render there.

Every push to `main` that touches `packages/web/` now redeploys automatically.

---

## Option B — GitHub Actions + Wrangler (keeps deploys in this repo)

Use this if you prefer the repo to drive deploys (e.g. to keep the repo private,
or to gate releases through CI).

1. Create a Pages project once (dashboard → Pages → **Create** →
   **Direct Upload**, name it `korin-pink`), or it will be created on first
   `wrangler pages deploy`.
2. In GitHub → **Settings → Secrets and variables → Actions**:
   - **Secrets:** `CLOUDFLARE_API_TOKEN` (token with *Cloudflare Pages: Edit*),
     `CLOUDFLARE_ACCOUNT_ID`.
   - **Variables:** `DEPLOY_WEB` = `true` (this arms the workflow). Optionally
     `CF_PAGES_PROJECT` if you named the project something other than
     `korin-pink`.
3. Push to `main` (or run the **deploy-web** workflow manually). It runs
   `wrangler pages deploy packages/web`.

---

## Step 1 — Attach the custom domain + Cloudflare DNS

Once a Pages deployment is live:

1. Pages project → **Custom domains** → **Set up a custom domain** →
   enter `korin.pink`.
2. Because the zone is already on Cloudflare, it auto-creates the DNS record
   (a `CNAME` flattened to the `*.pages.dev` target, proxied). Add `www` the
   same way if you want it.
3. SSL/TLS is automatic (Cloudflare issues the cert). Set the zone's SSL mode to
   **Full** for the future backend origin.

That's it — `https://korin.pink` now serves the portal.

### DNS records summary

| Type  | Name             | Target                          | Notes                          |
| ----- | ---------------- | ------------------------------- | ------------------------------ |
| CNAME | `korin.pink`     | `<project>.pages.dev`           | created by Pages custom-domain |
| CNAME | `www`            | `<project>.pages.dev`           | optional                       |
| A     | `irc.korin.pink` | *(Ergo server IP — later)*      | for the IRC daemon backend     |
| CNAME | `api.korin.pink` | *(Cloud Run / VPS — later)*     | for the Fastify API backend    |

---

## What this does NOT cover (backend, later)

The portal's `/wiki` is served statically by the build command above. But
`/files`, `/ai`, and `irc://irc.korin.pink` need the API + Ergo backend, which
Cloudflare Pages cannot host (Ergo needs a persistent TCP process). When you're
ready, deploy `packages/api`,
`packages/irc-bridge`, and `packages/irc` to Cloud Run + Compute Engine (see
`docs/deploy/gcp.md`) or a VPS (`docs/deploy/vps.md`), then add the
`api`/`irc` subdomain records above. Note: `infra/gcp/main.tf` referenced by the
GCP guide does not exist yet and must be written before that path works.
