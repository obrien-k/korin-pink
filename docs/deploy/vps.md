# VPS — OVH / Hetzner / bare metal

Cheapest way to run korin.pink in production. Any Linux VPS works.
Tested on: Hetzner CX22 (€3.79/mo), OVH VPS Starter, Contabo VPS S.

## prerequisites

- VPS running Ubuntu 22.04+ or Debian 12+
- Domain with DNS access (`korin.pink`)
- SSH access as root or sudo user

## recommended specs

| resource | minimum | comfortable |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| disk | 20 GB | 40 GB |
| bandwidth | 1 TB/mo | unmetered |

Hetzner CX22 or OVH VPS Value hit the "comfortable" column for ~$5/mo.

## 1. server setup

```bash
# as root on fresh VPS
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 git ufw

# firewall
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # HTTP/3
ufw allow 6667/tcp  # IRC plain (STS redirect)
ufw allow 6697/tcp  # IRC TLS
ufw allow 8097/tcp  # IRC WebSocket
ufw enable

# docker without sudo (optional)
usermod -aG docker $USER && newgrp docker
```

## 2. DNS

Point these records at your VPS IP before deploying (Caddy needs HTTP-01 challenge):

```
A     korin.pink        → <your VPS IP>
A     irc.korin.pink    → <your VPS IP>
CNAME www.korin.pink    → korin.pink
```

Propagation: 5 min (Cloudflare) to 24h (others).

## 3. clone & configure

```bash
git clone https://github.com/your-org/korin.pink /opt/korin.pink
cd /opt/korin.pink
cp .env.example .env
nano .env   # fill in all secrets
echo "DOMAIN=korin.pink" >> .env
```

## 4. TLS for Ergo

Caddy handles TLS for HTTP automatically. Ergo needs its own cert.

Option A — share Caddy's certs (simplest):

```bash
# Caddy stores certs in the caddy_data volume at:
# /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/korin.pink/

# Run Caddy first to issue the cert, then copy to Ergo's expected path:
mkdir -p /opt/korin.pink/infra/tls

docker run --rm \
  -v korin_caddy_data:/data \
  alpine sh -c "
    cp /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/korin.pink/korin.pink.crt /out/fullchain.pem
    cp /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/korin.pink/korin.pink.key /out/privkey.pem
  "
# (adjust path once you know where Caddy wrote them)
```

Option B — certbot standalone (most reliable):

```bash
apt install -y certbot
certbot certonly --standalone -d korin.pink -d irc.korin.pink

# symlink into infra/tls
mkdir -p /opt/korin.pink/infra/tls
ln -sf /etc/letsencrypt/live/korin.pink/fullchain.pem /opt/korin.pink/infra/tls/fullchain.pem
ln -sf /etc/letsencrypt/live/korin.pink/privkey.pem   /opt/korin.pink/infra/tls/privkey.pem

# auto-renew (runs twice daily via systemd timer)
systemctl enable --now certbot.timer

# after renew, restart ergo to pick up new cert
echo '0 3 * * * root certbot renew --quiet && docker compose -f /opt/korin.pink/infra/docker-compose.yml restart ergo' \
  > /etc/cron.d/certbot-ergo
```

## 5. deploy

```bash
cd /opt/korin.pink/infra
TLS_DIR=./tls docker compose up -d --build
docker compose logs -f
```

## 6. Ergo first-run setup

```bash
docker compose exec ergo sh
ergo genpasswd   # for the stellar-bridge oper account
# update packages/irc/ergo.yaml with the hash
# rebuild: docker compose up ergo --build -d
```

## 7. systemd service (optional, recommended)

Auto-start on reboot:

```bash
cat > /etc/systemd/system/korin.service << 'UNIT'
[Unit]
Description=korin.pink
Requires=docker.service
After=docker.service

[Service]
WorkingDirectory=/opt/korin.pink/infra
ExecStart=docker compose up
ExecStop=docker compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now korin
```

## 8. updates

```bash
cd /opt/korin.pink
git pull
cd infra
docker compose up -d --build
```

Or set up a GitHub Actions deploy job that SSHes in and runs this — see `.github/workflows/deploy.yml`.

## SSH deploy key (for CI/CD)

```bash
# on VPS
ssh-keygen -t ed25519 -f ~/.ssh/korin_deploy -N ""
cat ~/.ssh/korin_deploy.pub >> ~/.ssh/authorized_keys

# add ~/.ssh/korin_deploy (private key) as GH secret VPS_SSH_KEY
# add your VPS IP as GH secret VPS_HOST
```
