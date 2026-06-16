import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// packages/irc/test -> packages/irc
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ergoYaml = resolve(pkg, 'ergo.yaml');

// Validate against the SAME Ergo image the Dockerfile ships, so this test
// catches drift between our config and the version we actually deploy.
const dockerfile = readFileSync(resolve(pkg, 'Dockerfile'), 'utf8');
const image = dockerfile.match(/^FROM\s+(\S+)/m)?.[1] ?? 'ghcr.io/ergochat/ergo:stable';

function ok(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Boot the mounted config in a throwaway container and capture Ergo's output.
// The committed config ships empty oper passwords (set via `ergo genpasswd` at
// deploy); inject a structurally-valid placeholder bcrypt hash so the boot
// reaches listener + config validation, which is what we're testing.
const PLACEHOLDER = '$2a$04$0123456789abcdef0123456789abcdef0123456789abcdef01234';
const BOOT = [
  `sed 's|password: ""|password: "${PLACEHOLDER}"|g' /in.yaml > /tmp/ergo.yaml`,
  'mkdir -p /etc/ergo/tls /etc/ergo /var/lib/ergo',
  'cp /ircd-bin/ergo.motd /etc/ergo/motd.txt 2>/dev/null || true',
  'cd /tmp',
  '/ircd-bin/ergo mkcerts --conf /tmp/ergo.yaml >/dev/null 2>&1 || true',
  'timeout 5 /ircd-bin/ergo run --conf /tmp/ergo.yaml 2>&1 || true',
].join('\n');

test('ergo.yaml loads and reaches "Server running" in the pinned Ergo image', (t) => {
  if (!ok('docker', ['version'])) {
    t.skip('docker unavailable — integration test requires Docker');
    return;
  }
  if (!ok('docker', ['image', 'inspect', image])) {
    t.skip(`image not pulled — run: docker pull ${image}`);
    return;
  }

  const out = execFileSync(
    'docker',
    ['run', '--rm', '-v', `${ergoYaml}:/in.yaml:ro`, '--entrypoint', 'sh', image, '-c', BOOT],
    { encoding: 'utf8', timeout: 90_000 },
  );

  assert.doesNotMatch(out, /did not load successfully/, `Ergo rejected the config:\n${out}`);
  assert.match(out, /Server running/, `Ergo never reached "Server running":\n${out}`);
  // A clean boot has no warnings (e.g. unset history.chathistory-maxmessages).
  assert.doesNotMatch(out, /\bwarn\b.*chathistory/, `unexpected history warning:\n${out}`);
});
