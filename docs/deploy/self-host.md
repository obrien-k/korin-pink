# Self-host / ngrok

Fastest way to get korin.pink running — on any machine, no domain required.

## prerequisites

- Docker + Docker Compose
- [ngrok](https://ngrok.com) account (free tier works)

## 1. clone & configure

```bash
git clone https://github.com/your-org/korin.pink
cd korin.pink
cp .env.example .env
# fill in .env — minimum required:
#   STELLAR_API_URL, STELLAR_API_KEY, GEMINI_API_KEY
#   IRC_BRIDGE_SECRET (any random string)
```

## 2. TLS for Ergo (local)

Ergo requires TLS. For local dev, use [mkcert](https://github.com/FiloSottile/mkcert):

```bash
brew install mkcert   # or apt/pacman equivalent
mkcert -install
mkdir -p infra/tls
mkcert -cert-file infra/tls/fullchain.pem \
       -key-file  infra/tls/privkey.pem \
       localhost 127.0.0.1 ::1
```

## 3. start everything

```bash
cd infra
TLS_DIR=./tls DOMAIN=localhost docker compose up --build
```

Services:
| | |
|---|---|
| web | http://localhost |
| api | http://localhost/api |
| IRC | localhost:6697 (TLS) |

The local Docusaurus `wiki` service is **opt-in** (it OOMs small VPSes and is
served from Cloudflare Pages in prod). To run it locally — `/wiki` will 502
without it — add the profile:

```bash
TLS_DIR=./tls DOMAIN=localhost docker compose --profile wiki up --build
```

## 4. expose with ngrok

To make IRC reachable from real clients (or expose to Stellar):

```bash
# In separate terminals:

# Expose the API / web
ngrok http 80

# Expose IRC (requires ngrok paid plan for TCP)
ngrok tcp 6697
```

Update `STELLAR_API_URL` in `.env` with the ngrok HTTPS URL so the bridge can reach stellar-api.

Set `DOMAIN` to your ngrok subdomain (`abc123.ngrok-free.app`) and restart Caddy:

```bash
DOMAIN=abc123.ngrok-free.app docker compose up caddy --force-recreate
```

## 5. Ergo first-run setup

```bash
# Get a shell into the ergo container
docker compose exec ergo sh

# Create the bot oper password hash
ergo genpasswd
# paste the hash into packages/irc/ergo.yaml under opers.stellar-bridge.password
# then rebuild: docker compose up ergo --build
```

## notes

- IRC history and accounts persist in the `ergo_data` Docker volume.
- ngrok TCP tunnels require a paid ngrok plan. Alternative: use `cloudflared` TCP tunnel (free).
- For persistent self-hosting without a public IP, see the [VPS guide](vps.md).
