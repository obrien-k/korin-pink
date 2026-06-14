# korin.pink

stellar community infrastructure — IRC, files, wiki, mail, AI.

## packages

| package | description |
|---|---|
| `api` | Fastify HTTP API — files, wiki, IRC metrics, AI, mail |
| `web` | Minimal static portal |
| `irc` | Ergo IRCd config + Dockerfile |
| `irc-bridge` | Node bot: Ergo events → metrics → stellar-api |

## stellar integration

korin.pink is Stellar's IRC infrastructure layer.

The `irc-bridge` accumulates per-user signals and flushes them to the API.  
`stellar-api` polls `/irc/metrics` to update each user's IRCScore within the CRS.

```
IRCScore = activity * consistency * channelQuality   (PRD v0.0.4)
```

## local dev

```bash
cp .env.example .env
# fill in your secrets

cd infra
docker compose up
```

| service | address |
|---|---|
| IRC (TLS) | `localhost:6697` |
| IRC (plain/STS) | `localhost:6667` |
| IRC (WebSocket) | `localhost:8097` |
| API | `http://localhost:3000` |
| web | `http://localhost:5173` |

## deployment

The entire stack runs on Docker. Pick your platform:

| guide | when to use |
|---|---|
| [Self-host / ngrok](docs/deploy/self-host.md) | local machine, quick tunneling |
| [VPS — OVH / Hetzner / bare metal](docs/deploy/vps.md) | full control, cheapest long-term |
| [AWS](docs/deploy/aws.md) | EC2 + ECS |
| [GCP](docs/deploy/gcp.md) | Cloud Run + Compute Engine + Workspace |

> **Note on Ergo:** the IRC daemon requires persistent TCP — serverless/function platforms
> won't work for it. Every guide runs Ergo on a persistent instance.

## irc

Connect to `irc.korin.pink:6697` (TLS) with any IRC client.  
Auth via SASL using your Stellar account credentials.

## stack

- **IRC** — Ergo IRCd (IRCv3, SASL, history, TLS)
- **API** — Node.js 20 + Fastify 4 + TypeScript
- **AI** — Gemini 1.5 Flash (swappable — see `packages/api/src/lib/gemini.ts`)
- **File storage** — Google Drive (swappable — see `packages/api/src/lib/drive.ts`)
- **Mail** — Gmail API / korin.pink custom domain
- **Proxy** — Caddy (TLS, reverse proxy, static files)
- **CI/CD** — GitHub Actions (platform-agnostic build; deploy job per target)
