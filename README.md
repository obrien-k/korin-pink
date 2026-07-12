# korin.pink 🌸

Public infrastructure layer and CRS bridge for Stellar's IRC operations.

## Architecture
- **`packages/api`**: Fastify API managing Google Drive, Gemini AI, Gmail, and the `/irc/metrics` boundary.
- **`packages/irc-bridge`**: Node.js daemon that connects to the private Ergo server, tracks user presence, and flushes metrics to the API.
- **`packages/web`**: Astro app — landing portal at `/` plus the community wiki (Astro Starlight) at `/wiki/*`, built into a single static `dist/`. In the self-hosted stack it doubles as the **front door / minified orchestrator** — Caddy (`infra/Caddyfile`) is the single entrypoint that routes each service by path prefix.

### Front-door routing (self-hosted)

| Path      | Service                                  |
| --------- | ---------------------------------------- |
| `/`       | landing portal (`packages/web` Astro)    |
| `/wiki/*` | Starlight wiki (same `dist/`)            |
| `/chat/*` | gamja web IRC client (same `dist/`)      |
| `/api/*`  | Fastify API container                    |

New services (e.g. `/files`, `/ai`) slot in as additional `handle` blocks in
`infra/Caddyfile`. Bring the whole stack up with `cd infra && docker compose up --build`.

*Note: The actual Ergo IRC daemon and its configuration are maintained privately in `korin-omnibus` to protect proprietary connection limits and rules.*
