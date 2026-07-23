import { z } from 'zod';

/**
 * Boot-time config seam. One place reads + validates the environment.
 *
 * Validates SHAPE, not the presence of secrets: the server boots in a partial
 * deploy and each guarded path fails closed until its secret is set (stellar-api
 * ADR-0013 — "each path fails closed until set"). Validation runs at boot via
 * loadConfig() — NEVER at import — so routes and libs stay importable in tests.
 */
const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),

  // Shared secrets — optional. Absent → the guarding route returns 401
  // (see lib/auth.ts requireSharedSecret); never a boot failure.
  stellarPullKey: z.string().min(1).optional(),
  ircBridgeSecret: z.string().min(1).optional(),

  // korin → stellar client (wired-for-later; see lib/stellar.ts). URL shape is
  // validated when present; absence is tolerated and fails at call time.
  stellarApiUrl: z.string().url().optional(),
  stellarApiKey: z.string().min(1).optional(),

  // api → irc-bridge delivery (ADR-006). Absent URL fails at call time, so
  // /irc/announce answers 503 and stellar retries — never a boot failure.
  // The channel is the api's to name; the bridge rejects any it hasn't joined.
  ircBridgeUrl: z.string().url().optional(),
  announceChannel: z.string().min(1).default('#announce'),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Resolve + validate config once. Empty-string env vars are treated as unset. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse({
    port: env.PORT,
    stellarPullKey: env.STELLAR_PULL_KEY || undefined,
    ircBridgeSecret: env.IRC_BRIDGE_SECRET || undefined,
    stellarApiUrl: env.STELLAR_API_URL || undefined,
    stellarApiKey: env.STELLAR_API_KEY || undefined,
    ircBridgeUrl: env.IRC_BRIDGE_URL || undefined,
    announceChannel: env.ANNOUNCE_CHANNEL || undefined,
  });
}
