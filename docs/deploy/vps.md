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

## 1b. Security hardening (free abuse/flood mitigation)

A brand-new domain gets probed on every open port immediately. We mitigate this
for **$0** with host + container + app-layer controls. Run the generated script
as the **Vultr "Startup Script"** (or by hand on first boot):

```bash
# Generated from the tested logic in packages/harden (pnpm --filter @korin/harden render)
SSH_ALLOW_CIDR=<your.admin.ip>/32 IRC_ENABLED=false bash infra/vultr-startup.sh
```

It applies: `ufw` (default-deny; SSH limited to your IP, the default world-open
`22/tcp` rule removed), kernel SYN-flood sysctls, SSH key-only via the
`/etc/ssh/sshd_config.d/00-korin-harden.conf` drop-in (a 00- drop-in outranks
cloud-init's, which a `sed` on the main config would not), `fail2ban` (SSH + Ergo
via `infra/fail2ban/ergo.conf`), and the **DOCKER-USER** firewall chain with
per-IP rate + concurrency limits on the IRC ports.

> Docker empties the `DOCKER-USER` chain every daemon start, so the script
> installs a `korin-docker-user.service` systemd oneshot (ordered
> `After=docker.service`) that replays the rules on every boot — Ubuntu 24.04
> `Breaks` the old `netfilter-persistent` package under `ufw`, so this replaces
> it. Re-running with `IRC_ENABLED=true` updates `/etc/korin/irc_enabled`, which
> the unit honours on the next boot.

> ⚠️ **Docker-published ports bypass `ufw`.** Docker inserts its own iptables
> rules, so `ufw allow/deny` on `6697/8097/6667` does **nothing**. The real
> filter is the **`DOCKER-USER`** chain — that's what the script populates. The
> `ufw` IRC rules in the manual steps below are effectively no-ops; they're kept
> only for clarity.

> ⚠️ **Two firewalls on Vultr.** If you attach a **Vultr Firewall Group** (cloud
> level), you must open the same ports there *in addition to* `ufw`/`DOCKER-USER`.
> A port that works locally but not remotely is almost always the Vultr group.

**Keep IRC closed until Ergo is live.** The script defaults to `IRC_ENABLED=false`
— it opens only `22/80/443` and leaves `6697/8097/6667` closed. After Ergo is
up (step 6), re-run with `IRC_ENABLED=true` to open and rate-limit the IRC ports.

**Honest limit:** this stops connection floods, brute force, and app-layer abuse
— *not* a true volumetric (L3/4) DDoS, which saturates the link before the box
sees it. If you're ever targeted that way, enable Vultr's DDoS Protection add-on
(region-gated, paid) or front IRC with Cloudflare Spectrum. For v0.x, reacting
if it happens is a reasonable $0 bet; Ergo's `ip-limits`/`fakelag` are the
app-layer backstop.

## 2. DNS

Point these records at your VPS IP before deploying (Caddy needs HTTP-01 challenge):

```
A     korin.pink        → <your VPS IP>
A     irc.korin.pink    → <your VPS IP>
CNAME www.korin.pink    → korin.pink
```

> **On Cloudflare:** `irc.korin.pink` must be **DNS-only (grey cloud)** — the
> orange-cloud proxy doesn't carry IRC/TLS on 6697/8097 (that needs Spectrum).
> Ergo terminates its own Let's Encrypt cert (step 4). If korin.pink's web is on
> Cloudflare Pages, you only need the `irc.` record here; otherwise proxy the web
> records as normal.

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
ufw allow 80/tcp        # certbot --standalone is a host listener; DOCKER-USER
                        # only filters Docker-published ports, not host procs
certbot certonly --standalone -d irc.korin.pink

# Copy REAL files into infra/tls — do NOT symlink. Only infra/tls is bind-mounted
# into the ergo container; a symlink into /etc/letsencrypt dangles inside the
# container (that path isn't mounted) and Ergo fails with "no such file".
mkdir -p /opt/korin.pink/infra/tls
cp /etc/letsencrypt/live/irc.korin.pink/fullchain.pem /opt/korin.pink/infra/tls/fullchain.pem
cp /etc/letsencrypt/live/irc.korin.pink/privkey.pem   /opt/korin.pink/infra/tls/privkey.pem
chmod 644 /opt/korin.pink/infra/tls/*.pem

# Because we copy (not symlink), a renewal won't propagate on its own. Register a
# deploy-hook so each successful renewal re-copies the cert and restarts Ergo.
# (certbot.timer already runs `certbot renew` twice daily.)
certbot certonly --standalone -d irc.korin.pink \
  --deploy-hook 'cp /etc/letsencrypt/live/irc.korin.pink/fullchain.pem /opt/korin.pink/infra/tls/fullchain.pem; cp /etc/letsencrypt/live/irc.korin.pink/privkey.pem /opt/korin.pink/infra/tls/privkey.pem; docker compose -f /opt/korin.pink/infra/docker-compose.yml restart ergo'
```

> We issue only the `irc.` cert here — the web apex is served by Cloudflare Pages,
> so Ergo is the only thing on this box that needs a public cert.

## 5. deploy

```bash
cd /opt/korin.pink/infra
TLS_DIR=./tls docker compose up -d --build
docker compose logs -f
```

> The `wiki` service is profile-gated and **excluded by default** — its
> Docusaurus build OOMs a 1 GB box and the wiki is already served from
> Cloudflare Pages. Caddy's `/wiki/*` route will 502 here, which is expected.
> Only run it locally if you have the RAM (≥2 GB / swap): add `--profile wiki`.

## 6. Ergo first-run setup

### 6a. Oper passwords

`ergo.yaml` ships two oper accounts with empty passwords — `korin-admin` (the
human SysOp) and `stellar-bridge` (the irc-bridge bot). Generate a hash for each
and paste it into the matching `password:` field:

`genpasswd` is interactive: it prompts for a plaintext password you choose and
prints a bcrypt hash (`$2a$...`). The **hash** goes in `ergo.yaml`; the
**plaintext** is what you type at `/OPER` later. Run it once per oper:

```bash
# --entrypoint bypasses the image's run.sh wrapper (which isn't on PATH)
docker compose run --rm --entrypoint /ircd-bin/ergo ergo genpasswd
# update packages/irc/ergo.yaml (opers.korin-admin.password / opers.stellar-bridge.password)
# config is baked at build time, so rebuild after editing:
docker compose up ergo --build -d
```

### 6b. Reserve the core channels (SysOp)

Ergo has no static "reserved channels" config — channels are registered at
runtime, and `channels.registration.operator-only: true` means **only an oper
can register them**. So claim the core names once, as the SysOp, before
announcing the server publicly. Connect with any IRC client over TLS
(`irc.korin.pink:6697`) and:

```text
# 1. register the SysOp's NickServ account (this account becomes channel founder)
/msg NickServ REGISTER <strong-password> you@korin.pink

# 2. oper up with the korin-admin /OPER credential from 6a
/OPER korin-admin <oper-password>

# 3. register the core channels (operator-only gate now satisfied)
/msg ChanServ REGISTER #announce
/msg ChanServ REGISTER #stellar
/msg ChanServ REGISTER #korin

# 4. let the bridge bot post release announcements to #announce
#    (grant its account persistent op; the bot SASLs in as stellar-bridge)
/msg ChanServ AMODE #announce +o stellar-bridge

# 5. (optional) lock topics to ops on the announce channel
/mode #announce +t
```

> The `stellar-api` integration contract (ADR-0013) renders release artifacts to
> **`#announce`** — that channel name is load-bearing, keep it. `#stellar` is
> project chat; `#korin` is infra/meta. Registering them as the SysOp makes that
> account their founder, so governance survives restarts.

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
