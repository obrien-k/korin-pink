import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

// packages/irc/test -> packages/irc
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = parse(readFileSync(resolve(pkg, 'ergo.yaml'), 'utf8'));

// Ergo's full oper-class capability vocabulary (from `ergo defaultconfig`,
// v2.18.0). Ergo silently ignores capabilities outside this set — a typo is a
// no-op, not a boot error — so the boot test can't catch it; this list can.
const ALLOWED_CAPABILITIES = new Set([
  'kill',
  'ban',
  'nofakelag',
  'relaymsg',
  'vhosts',
  'sajoin',
  'samode',
  'snomasks',
  'roleplay',
  'rehash',
  'accreg',
  'chanreg',
  'history',
  'defcon',
  'massmessage',
  'metadata',
]);

test('every oper-class capability is a real Ergo token (Ergo ignores typos silently)', () => {
  const classes: Record<string, { capabilities?: string[] }> = config['oper-classes'] ?? {};
  for (const [name, def] of Object.entries(classes)) {
    for (const cap of def.capabilities ?? []) {
      assert.ok(
        ALLOWED_CAPABILITIES.has(cap),
        `oper-class "${name}" uses unknown capability "${cap}" — Ergo will silently ignore it`,
      );
    }
  }
});

test('every oper references an oper-class that exists (dangling refs break boot)', () => {
  const classes = config['oper-classes'] ?? {};
  const opers: Record<string, { class?: string }> = config.opers ?? {};
  for (const [name, def] of Object.entries(opers)) {
    assert.ok(def.class, `oper "${name}" has no class`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(classes, def.class as string),
      `oper "${name}" references missing oper-class "${def.class}"`,
    );
  }
});

test('a human SysOp exists that can govern channel registrations', () => {
  const classes: Record<string, { capabilities?: string[] }> = config['oper-classes'] ?? {};
  const opers: Record<string, { class?: string }> = config.opers ?? {};
  // The SysOp needs `chanreg` to register/manage the core community channels.
  const governs = Object.values(opers).some((o) =>
    (classes[o.class as string]?.capabilities ?? []).includes('chanreg'),
  );
  assert.ok(governs, 'expected at least one oper whose class has the "chanreg" capability');
});

test('channel registration is operator-only (core channels cannot be squatted)', () => {
  assert.equal(
    config.channels?.registration?.['operator-only'],
    true,
    'channels.registration.operator-only must be true',
  );
});
