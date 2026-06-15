import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFirewallRules, buildIrcPortRules, type FirewallConfig } from './firewall.js';

function cfg(overrides: Partial<FirewallConfig> = {}): FirewallConfig {
  return {
    sshAllowCidr: '203.0.113.4/32',
    ircEnabled: false,
    ircPorts: [6697, 8097, 6667],
    newConnsPerMinPerIp: 30,
    maxConcurrentPerIp: 8,
    ...overrides,
  };
}

test('default-denies new inbound to Docker-published ports', () => {
  const rules = buildFirewallRules(cfg());
  // The DOCKER-USER chain must end by dropping anything not explicitly allowed,
  // because Docker-published ports bypass ufw entirely.
  const last = rules.at(-1);
  assert.match(last ?? '', /DOCKER-USER.*-j DROP/);
});

test('rate-limits new IRC connections per IP when IRC is enabled', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: true }));
  for (const port of [6697, 8097, 6667]) {
    assert.ok(
      rules.some((r) => r.includes(`--dport ${port}`) && r.includes('--hashlimit')),
      `expected a hashlimit (rate) rule for port ${port}`,
    );
  }
});

test('caps concurrent IRC connections per IP when IRC is enabled', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: true, maxConcurrentPerIp: 8 }));
  for (const port of [6697, 8097, 6667]) {
    assert.ok(
      rules.some((r) => r.includes(`--dport ${port}`) && r.includes('--connlimit-above 8')),
      `expected a connlimit rule for port ${port}`,
    );
  }
});

test('buildIrcPortRules emits rate + conn + accept per port, accept last', () => {
  const rules = buildIrcPortRules([6697], { newConnsPerMinPerIp: 30, maxConcurrentPerIp: 8 });
  assert.ok(rules.some((r) => r.includes('--dport 6697') && r.includes('--hashlimit')));
  assert.ok(rules.some((r) => r.includes('--dport 6697') && r.includes('--connlimit-above 8')));
  const acceptIdx = rules.findIndex((r) => /-j RETURN/.test(r));
  const lastDropIdx = rules.reduce((a, r, i) => (r.includes('-j DROP') ? i : a), -1);
  assert.ok(acceptIdx > lastDropIdx, 'accept must follow the limit drops');
});

test('keeps IRC ports closed until Ergo is live (ircEnabled=false)', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: false }));
  for (const port of [6697, 8097, 6667]) {
    assert.ok(
      !rules.some((r) => r.includes(`--dport ${port}`)),
      `port ${port} must have no rules until Ergo is live`,
    );
  }
});

test('lets established/related traffic return before any limiting', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: true }));
  const estIdx = rules.findIndex(
    (r) => r.includes('ESTABLISHED,RELATED') && /-j RETURN/.test(r),
  );
  assert.ok(estIdx >= 0, 'expected an established/related RETURN rule');
  assert.equal(estIdx, 0, 'established/related RETURN must be the first rule');
});

test('allows conforming IRC connections when enabled (accept after the limit drops)', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: true }));
  for (const port of [6697, 8097, 6667]) {
    const acceptIdx = rules.findIndex(
      (r) => r.includes(`--dport ${port}`) && /-j (RETURN|ACCEPT)/.test(r),
    );
    assert.ok(acceptIdx >= 0, `expected an accept/RETURN rule for port ${port}`);
    // The accept must come AFTER this port's limit drops, or floods get accepted.
    const lastDropIdx = rules.reduce(
      (acc, r, i) => (r.includes(`--dport ${port}`) && r.includes('-j DROP') ? i : acc),
      -1,
    );
    assert.ok(acceptIdx > lastDropIdx, `accept for ${port} must follow its limit drops`);
  }
});
