import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaseAllowRules,
  buildFirewallRules,
  buildIrcPortRules,
  type FirewallConfig,
} from './firewall.js';

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

test('allows container egress even when IRC is closed (LE / stellar / image pulls)', () => {
  // The blanket DROP governs ALL forwarded traffic, so without an egress allow
  // the perimeter strangles container egress — npm at build, Let's Encrypt and
  // stellar-api at runtime. Must hold regardless of $IRC_ENABLED.
  const rules = buildFirewallRules(cfg({ ircEnabled: false }));
  const egress = rules.find(
    (r) => /-o eth0/.test(r) && /--ctstate NEW/.test(r) && /-j RETURN/.test(r),
  );
  assert.ok(egress, 'expected a container-egress RETURN out the public iface');
});

test('allows inbound 80/443 (+443 udp) to the front-door Caddy', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: false }));
  assert.ok(
    rules.some((r) => /-i eth0/.test(r) && /--dports 80,443/.test(r) && /-j RETURN/.test(r)),
    'expected an inbound web RETURN for tcp 80,443',
  );
  assert.ok(
    rules.some((r) => /-i eth0/.test(r) && /-p udp --dport 443/.test(r) && /-j RETURN/.test(r)),
    'expected an inbound RETURN for udp 443 (HTTP/3)',
  );
});

test('base allows sit after established RETURN and before the default DROP', () => {
  const rules = buildFirewallRules(cfg({ ircEnabled: true }));
  const dropIdx = rules.findIndex((r) => r.includes('-j DROP'));
  const egressIdx = rules.findIndex((r) => /-o eth0/.test(r) && /--ctstate NEW/.test(r));
  const webIdx = rules.findIndex((r) => /--dports 80,443/.test(r));
  assert.ok(egressIdx > 0 && webIdx > 0, 'egress + web allows must come after established RETURN');
  assert.ok(egressIdx < dropIdx && webIdx < dropIdx, 'base allows must precede the default DROP');
});

test('honours a custom public iface and web ports', () => {
  const rules = buildBaseAllowRules({ publicIface: 'ens3', webPorts: [80, 443, 8080] });
  assert.ok(rules.some((r) => /-o ens3/.test(r)), 'egress must use the configured iface');
  assert.ok(rules.some((r) => /--dports 80,443,8080/.test(r)), 'web allow must use the configured ports');
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
