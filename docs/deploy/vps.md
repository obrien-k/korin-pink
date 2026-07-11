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

# Issue the cert AND register the renewal deploy-hook in one call. We copy the
# cert into infra/tls (symlinks into /etc/letsencrypt dangle inside the ergo
# container — that path isn't bind-mounted), so renewals won't propagate on
# their own; the deploy-hook re-copies + restarts Ergo on each renewal. The
# hook is saved to the renewal config on first issuance and runs on every
# `certbot renew` thereafter (certbot.timer runs it twice daily).
certbot certonly --standalone -d irc.korin.pink \
  --deploy-hook 'cp /etc/letsencrypt/live/irc.korin.pink/fullchain.pem /opt/korin.pink/infra/tls/fullchain.pem; cp /etc/letsencrypt/live/irc.korin.pink/privkey.pem /opt/korin.pink/infra/tls/privkey.pem; docker compose -f /opt/korin.pink/infra/docker-compose.yml restart ergo'

# Deploy-hooks do NOT run on the initial issuance, so do the first copy by hand.
# The ergo container runs as root, so the private key can stay 600 (don't 644 it).
mkdir -p /opt/korin.pink/infra/tls
cp /etc/letsencrypt/live/irc.korin.pink/fullchain.pem /opt/korin.pink/infra/tls/fullchain.pem
cp /etc/letsencrypt/live/irc.korin.pink/privkey.pem   /opt/korin.pink/infra/tls/privkey.pem
chmod 644 /opt/korin.pink/infra/tls/fullchain.pem
chmod 600 /opt/korin.pink/infra/tls/privkey.pem
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

### 6a. Oper passwords (box-local config)

`packages/irc/ergo.yaml` is a **template**: it defines the `korin-admin` (human
SysOp) and `stellar-bridge` (irc-bridge bot) opers with **empty** passwords, so no
secret is ever committed. The real bcrypt hashes live in a **box-local** copy that
is mounted over the baked template at runtime (`ERGO_CONF`) — never committed.

1. Create the box-local config (git-ignored) from the template:

   ```bash
   cp packages/irc/ergo.yaml infra/ergo.local.yaml
   ```

2. Generate a bcrypt hash for each oper. `genpasswd` is interactive: it prompts for
   a plaintext you choose and prints a hash (`$2a$...`). The **hash** goes in the
   config; the **plaintext** is what you type at `/OPER` later.

   ```bash
   # --entrypoint bypasses the image's run.sh wrapper (which isn't on PATH)
   docker compose run --rm --entrypoint /ircd-bin/ergo ergo genpasswd
   ```

3. Paste each hash into the matching `password:` field in **`infra/ergo.local.yaml`**
   (`opers.korin-admin.password` / `opers.stellar-bridge.password`) — NOT the tracked
   `packages/irc/ergo.yaml`.

4. Point the mount at it and (re)start Ergo — no rebuild needed, the config is now
   mounted, not baked:

   ```bash
   grep -q '^ERGO_CONF=' .env || echo 'ERGO_CONF=./ergo.local.yaml' >> .env
   docker compose up ergo -d
   ```

> When `packages/irc/ergo.yaml` changes upstream (new listener, `allowed-origins`,
> etc.), re-apply those edits to `infra/ergo.local.yaml` — the box-local copy does
> not auto-track the template.

### 6b. Reserve the core channels (SysOp)

Ergo has no static "reserved channels" config — channels are registered at
runtime, and `channels.registration.operator-only: true` means **only an oper
can register them**. So claim the core names once, as the SysOp, before
announcing the server publicly. Connect with any IRC client over TLS
(`irc.korin.pink:6697`) and run the steps below — this is a one-time bootstrap
while you're connected in that first session. How you log back in on **every
later** connection (and what to do when it won't let you) is §6c.

```text
# 1. register the SysOp's NickServ account (this account becomes channel founder)
/msg NickServ REGISTER <strong-password> you@korin.pink

# 2. oper up with the korin-admin /OPER credential from 6a
/OPER korin-admin <oper-password>

# 3. join THEN register each core channel. A channel doesn't exist until someone
#    joins it, and ChanServ can't register a channel that doesn't exist — joining
#    creates it and makes you its first op. operator-only only gates REGISTER.
/join #announce
/msg ChanServ REGISTER #announce
/join #stellar
/msg ChanServ REGISTER #stellar
/join #korin
/msg ChanServ REGISTER #korin

# 4. create the bridge bot's NickServ ACCOUNT. AMODE (step 5) grants op to an
#    account, and the bot SASLs in with this — so it must exist first. The
#    `stellar-bridge` entry in ergo.yaml is only an OPER definition; it does not
#    create an account. SAREGISTER makes it directly (needs `accreg`, which you
#    hold via the korin-admin oper from step 2). Its password MUST equal
#    IRC_SASL_PASS in the bridge env, paired with IRC_SASL_USER=stellar-bridge.
/msg NickServ SAREGISTER stellar-bridge <bridge-account-password>

# 5. grant the bot persistent op in #announce so it can post release announcements
/msg ChanServ AMODE #announce +o stellar-bridge

# 6. (optional) lock topics to ops on the announce channel
/mode #announce +t
```

> The `stellar-api` integration contract (ADR-0013) renders release artifacts to
> **`#announce`** — that channel name is load-bearing, keep it. `#stellar` is
> project chat; `#korin` is infra/meta. Registering them as the SysOp makes that
> account their founder, so governance survives restarts.

### 6c. Logging in on later connections (SASL) — and troubleshooting

§6b assumes you're already connected and authenticated in that first session.
**Every connection after that, you must re-authenticate** — and because
`nick-reservation: strict` + `force-nick-equals-account` (required by ADR-0015's
verified-nick model, so it can't be relaxed), your registered nick is *refused*
until you do. Authenticate with **SASL**, not a post-connect `/msg NickServ
IDENTIFY`: SASL runs during the handshake, before the nick is assigned, so it
just works. Post-connect IDENTIFY fights the reservation — by the time you can
type it, your client has already been bumped off the reserved nick.

**Two separate credentials.** Conflating these is the single most common cause of
"my password doesn't work":

| Credential | Used with | Lives in | Grants |
| --- | --- | --- | --- |
| `/OPER` password | `/OPER korin-admin <pw>` | bcrypt hash in `infra/ergo.local.yaml` (from `genpasswd`, §6a) | operator capabilities |
| account password | SASL / `NickServ IDENTIFY` | Ergo's account DB (set when you `REGISTER`) | the account + its reserved nick |

They are unrelated secrets. Feeding one where the other is expected fails silently-looking.
Oper status is also **per-session** — you `/OPER` again on every connect (SASL logs
in the account, not the oper), which is why an oper-only command like `SAREGISTER`
returns `Command restricted` right after a fresh SASL login until you re-oper.

**Happy path (fresh account).** Right after you `REGISTER` (§6b step 1) you *chose*
the account password — put it straight into your client's SASL config and
reconnect. Halloy (`config.toml`):

```toml
[servers.korin]
nickname = "korin-admin"       # = the account name under force-nick-equals-account
server = "irc.korin.pink"
port = 6697
use_tls = true

[servers.korin.sasl.plain]
username = "korin-admin"            # the ACCOUNT name
password = "<account-password>"    # or use password_command / password_file to avoid plaintext
```

irssi equivalent:

```text
/network modify -sasl_username korin-admin -sasl_password <account-password> -sasl_mechanism PLAIN korin
```

Any client: mechanism **PLAIN**, username = account name, password = account password.

> Configure SASL *before* pointing your client at a registered nick. A client set
> to `nickname = korin-admin` with **no** SASL is refused that nick on every
> connect (it's reserved) and can stall before the handshake finishes.

**Lost the account password?** You can't SASL with a secret you don't know, and
the reserved nick blocks a normal login — so break the loop as oper:

1. Reconnect on an **unreserved** nick (temporarily set your client's nickname to
   something else, e.g. `kai-setup`) so the handshake completes.
2. Oper up with the **`/OPER`** credential (§6a): `/OPER korin-admin <oper-password>`.
3. Reset the **account** password — the `sysop` oper-class has the `accreg`
   capability, which authorizes this:
   `/msg NickServ PASSWD korin-admin <new-account-password>` — wait for the
   explicit **`Password changed`** reply.
4. Put `<new-account-password>` into your SASL config, set the nick back to
   `korin-admin`, reconnect. You're in.

**Decoding the confusing errors.** All of these are stock Ergo (we run
`ghcr.io/ergochat/ergo:stable` unpatched) — the `korin.pink` prefix in a message
is just the server's name, not a korin-specific code path:

| Message | What it actually means | Fix |
| --- | --- | --- |
| `You need to register before you can use that command` | the **connection** handshake didn't finish (reserved-nick stall, or SASL mid-negotiation) — *not* about NickServ accounts | connect on an unreserved nick, or fix SASL, so registration completes |
| `Nickname is reserved by a different account` (`FAIL NICK NICKNAME_RESERVED`) | that nick is a registered account you're not authenticated as ("different" = different from your current anonymous session) | SASL in as that account |
| `Your nickname must match your account name; try logging out and logging back in with SASL` | you're logged into one account but tried to use another nick; `force-nick-equals-account` locks nick to account | reconnect and SASL as the account you want |
| `Command restricted` (on `SAREGISTER`, `SAPASSWD`, …) | that's an oper-capability command and you're not opered this session | `/OPER korin-admin <oper-password>` first, then retry |
| repeated `Authentication failed`, then the server goes quiet | `login-throttling` (3 failed logins / minute) locked you out | stop retrying, wait 60s, then try **once** with the correct password |

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
