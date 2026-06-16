import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStartupScript, type StartupOptions } from './startup.js';

function opts(overrides: Partial<StartupOptions> = {}): StartupOptions {
  return {
    ircPorts: [6697, 8097, 6667],
    limits: { newConnsPerMinPerIp: 30, maxConcurrentPerIp: 8 },
    ergoLog: '/opt/korin.pink/infra/ergo-data/ergo.log',
    ...overrides,
  };
}

/** The install line that pulls packages from apt. */
function aptInstallLine(script: string): string {
  return script.split('\n').find((l) => l.startsWith('apt-get install')) ?? '';
}

test('apt install line omits iptables-persistent/netfilter-persistent (ufw Breaks them on noble)', () => {
  const line = aptInstallLine(buildStartupScript(opts()));
  assert.ok(line, 'expected an apt-get install line');
  assert.doesNotMatch(line, /iptables-persistent/, 'ufw Breaks iptables-persistent on Ubuntu 24.04');
  assert.doesNotMatch(line, /netfilter-persistent/, 'ufw Breaks netfilter-persistent on Ubuntu 24.04');
});

test('still installs the core packages (docker, ufw, fail2ban)', () => {
  const line = aptInstallLine(buildStartupScript(opts()));
  for (const pkg of ['docker.io', 'ufw', 'fail2ban']) {
    assert.match(line, new RegExp(`\\b${pkg.replace('.', '\\.')}\\b`), `expected ${pkg} in the install line`);
  }
});

test('frames the DOCKER-USER chain established-RETURN -> IRC gate -> default-DROP', () => {
  const script = buildStartupScript(opts());
  const estIdx = script.indexOf('ESTABLISHED,RELATED -j RETURN');
  const gateIdx = script.indexOf('if [ "$IRC_ENABLED" = "true" ]', estIdx);
  const dropIdx = script.indexOf('DOCKER-USER -j DROP', gateIdx);
  assert.ok(estIdx >= 0, 'expected the established/related RETURN');
  assert.ok(gateIdx > estIdx, 'IRC rules are gated by $IRC_ENABLED after the established RETURN');
  assert.ok(dropIdx > gateIdx, 'default DROP must close the chain after the gated IRC rules');
});

test('closes the default world-open SSH rule, leaving only the admin-CIDR allow', () => {
  const script = buildStartupScript(opts());
  const lines = script.split('\n');
  const adminAllow = lines.findIndex((l) => /ufw allow from .*port 22/.test(l));
  const deleteOpen = lines.findIndex((l) => /ufw delete allow (22\/tcp|OpenSSH)/.test(l));
  assert.ok(adminAllow >= 0, 'expected the admin-CIDR SSH allow');
  assert.ok(deleteOpen >= 0, 'expected the default 22/tcp (or OpenSSH) allow to be removed');
  assert.ok(deleteOpen > adminAllow, 'remove the open rule AFTER adding the admin rule, never lock yourself out');
});

test('hardens sshd via a drop-in that outranks cloud-init, not a sed on the main config', () => {
  const script = buildStartupScript(opts());
  // /etc/ssh/sshd_config.d/50-cloud-init.conf re-enables password auth and a sed
  // on the main file loses to it. A 00- drop-in sorts first and wins.
  assert.match(script, /\/etc\/ssh\/sshd_config\.d\/00-korin-harden\.conf/, 'expected an sshd drop-in');
  const dropinBlock = script.slice(script.indexOf('00-korin-harden.conf'));
  assert.match(dropinBlock, /PasswordAuthentication no/);
  assert.match(dropinBlock, /PermitRootLogin prohibit-password/);
  // The unreliable sed on the main sshd_config must be gone.
  assert.doesNotMatch(script, /sed -i .* \/etc\/ssh\/sshd_config\b/, 'drop-in replaces the overridden sed');
});

test('provisions a swapfile idempotently (1 GB box runs api+bridge+ergo)', () => {
  const script = buildStartupScript(opts());
  // Only create the swapfile when it isn't already active, so re-runs are safe.
  assert.match(script, /swapon --show.*\/swapfile/, 'expected an idempotency guard on /swapfile');
  assert.match(script, /mkswap \/swapfile/, 'expected mkswap on the swapfile');
  assert.match(script, /swapon \/swapfile/, 'expected the swapfile to be enabled');
  // Persisted across reboots via fstab, and only appended once.
  const swapBlock = script.slice(script.indexOf('/swapfile'));
  assert.match(swapBlock, /\/etc\/fstab/, 'expected the swapfile persisted to /etc/fstab');
  assert.match(swapBlock, /grep -q .*\/swapfile .*\/etc\/fstab/, 'fstab entry must be added at most once');
  // swappiness lives in the sysctl drop-in (low: prefer RAM, swap is headroom).
  assert.match(script, /vm\.swappiness\s*=\s*10/, 'expected vm.swappiness=10 in the sysctl drop-in');
});

test('persists DOCKER-USER rules via a oneshot unit ordered after docker, not netfilter-persistent', () => {
  const script = buildStartupScript(opts());
  // netfilter-persistent is gone with its package, so the old save call must go too.
  assert.doesNotMatch(script, /netfilter-persistent save/, 'no netfilter-persistent on noble');
  // A systemd unit must re-apply the rules on boot (the DOCKER-USER chain is
  // flushed on reboot), and it must run after docker brings the chain back.
  assert.match(script, /\/etc\/systemd\/system\/korin-docker-user\.service/, 'expected a systemd unit file');
  assert.match(script, /Type=oneshot/, 'rule-replay is a oneshot, not a long-running service');
  assert.match(script, /After=docker\.service/, 'must run after docker.service recreates DOCKER-USER');
  assert.match(script, /systemctl enable .*korin-docker-user/, 'unit must be enabled to fire on boot');
});
