import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// packages/irc/test -> packages/irc
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dockerfile = readFileSync(resolve(pkg, 'Dockerfile'), 'utf8');

// These tests guard the *launch* path, which the config-validity boot test in
// ergo-config.test.ts cannot: that test runs `ergo run --conf` itself (via
// `--entrypoint sh`), so it proves the config is valid but never exercises how
// the Dockerfile actually starts Ergo. The deploy bug lived exactly there — the
// base image `ghcr.io/ergochat/ergo` ships an ENTRYPOINT wrapper
// (`/ircd-bin/run.sh`) that boots *stock* Ergo (default `ircd.yaml`, a generated
// `admin` oper, self-signed certs) and swallows a plain `CMD`. So our config
// silently never loaded. The invariant below: the image must bypass that wrapper
// and launch our config with the correct `run --conf <path>` invocation.

/** Parse an exec-form instruction (`INSTR ["a", "b"]`) into its token array. */
function execForm(name: string): string[] | null {
  const line = dockerfile
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.toUpperCase().startsWith(`${name} `));
  if (!line) return null;
  const json = line.slice(name.length).trim();
  assert.doesNotThrow(
    () => JSON.parse(json),
    `${name} must use exec form (a JSON array), got: ${json}`,
  );
  return JSON.parse(json) as string[];
}

/** Where `COPY ergo.yaml <dest>` lands the config inside the image. */
function configCopyDest(): string {
  const copy = dockerfile
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^COPY\s+ergo\.yaml\s+\S+/i.test(l));
  assert.ok(copy, 'Dockerfile must COPY ergo.yaml into the image');
  return copy!.split(/\s+/)[2];
}

test('Dockerfile overrides the base image wrapper ENTRYPOINT (else stock Ergo boots)', () => {
  const entrypoint = execForm('ENTRYPOINT');
  assert.ok(
    entrypoint,
    'Dockerfile must declare its own ENTRYPOINT — inheriting the base image ' +
      '`/ircd-bin/run.sh` wrapper boots stock Ergo and ignores our config',
  );
  assert.ok(
    entrypoint!.length > 0 && entrypoint![0].endsWith('ergo'),
    `ENTRYPOINT must invoke the ergo binary directly, got: ${JSON.stringify(entrypoint)}`,
  );
});

test('the effective launch runs `ergo run --conf <config>` against the copied config', () => {
  const tokens = [...(execForm('ENTRYPOINT') ?? []), ...(execForm('CMD') ?? [])];
  const dest = configCopyDest();

  assert.ok(tokens.includes('run'), `launch must use the \`run\` subcommand, got: ${JSON.stringify(tokens)}`);

  const confIdx = tokens.indexOf('--conf');
  assert.ok(confIdx !== -1, `launch must pass \`--conf\`, got: ${JSON.stringify(tokens)}`);
  assert.equal(
    tokens[confIdx + 1],
    dest,
    `\`--conf\` must point at the copied config (${dest}) so launch and config can't drift`,
  );
});
