# ADR-005: Astro + Starlight for the web portal and wiki

**Status:** Accepted
**Date:** 2026-06-29
**Repos:** obrien-k/korin-pink

---

## Context

The web layer was two separate things glued together at deploy time:

- `packages/web/` — a hand-maintained static landing portal (`index.html`,
  `styles.css`, `main.js`).
- `wiki/` — a Docusaurus 3 site built with `baseUrl: /wiki/`, compiled and copied
  into `packages/web/wiki/` by CI, and run as its own nginx container behind Caddy
  in the self-hosted stack.

This had real costs: the Docusaurus build is memory-hungry (it OOMs a 1 GB VPS, so
the self-hosted `wiki` container was profile-gated off by default and `/wiki/`
simply 502'd there); the portal and wiki used different toolchains (vanilla
HTML vs. Docusaurus' own npm/`package-lock.json`, separate from the pnpm
workspace); and shipping required a brittle "build wiki → copy into the portal"
step plus a second container. The wiki itself uses no Docusaurus-specific features
(no MDX, React components, admonitions, tabs, or Mermaid) — just plain Markdown —
so none of that machinery earned its keep.

---

## Decision

Replace both with a **single Astro application** at `packages/web/`:

- The landing page is an Astro page at `src/pages/index.astro` (a faithful port of
  the former terminal-aesthetic `index.html`), owning `/`.
- The wiki is **Astro Starlight**, with content under `src/content/docs/wiki/**`
  so it serves at `/wiki/*` **without** an Astro `base` path. All public `/wiki/`
  URLs are preserved.
- One `pnpm --filter @korin/web build` produces a single static `dist/` containing
  the portal, the wiki, and (copied from `public/chat/`) the gamja client at
  `/chat/`. No copy step, no separate wiki container.
- `packages/web` joins the pnpm workspace (Node 22, one lockfile); the standalone
  Docusaurus npm project and its nginx `Dockerfile` are deleted.

Self-hosted Caddy serves the unified `dist/` from its catch-all `file_server`; the
old `/wiki/*` reverse-proxy block and the `wiki` compose service are removed.

## Consequences

- **Simpler ship path:** one build, one artifact, one deploy target (Cloudflare
  Pages `dist/`, or Caddy serving `dist/`). CI drops the wiki build-and-copy.
- **No OOM footgun:** the Astro/Starlight build is light enough to run on a small
  VPS, so `/wiki/` works in the self-hosted stack instead of being opt-in.
- **Migration cleanup:** Docusaurus frontmatter (`id`, `sidebar_label`, `slug`)
  and legacy Jekyll fields (`permalink`, `layout`, `tags`) were normalized to the
  Starlight schema; route-hostile filenames (spaces, `&`, a CJK title, an
  extension-less file) were slugified to kebab-case; internal links were rewritten
  to root-absolute `/wiki/...` paths and `../uploads/...` to `/wiki/uploads/...`.
- **Branding:** the wiki now uses a pink accent matching the portal, replacing the
  default Docusaurus green.
- The wiki's edit-on-GitHub links now point at `packages/web/src/content/docs/wiki/`.
