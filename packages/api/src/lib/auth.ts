import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * One fail-closed shared-secret guard for every protected route. Replaces the
 * inline `if (!secret || header !== secret) 401` checks that were copy-pasted
 * per route (and drifted). Compares in constant time.
 *
 *   app.post('/irc/metrics',
 *     { preHandler: requireSharedSecret('x-bridge-secret', app.config.ircBridgeSecret) },
 *     handler);
 *
 * Fail-closed: an unset `expected` (secret not configured) always 401s.
 */
export function requireSharedSecret(headerName: string, expected: string | undefined) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const provided = request.headers[headerName];
    if (!expected || typeof provided !== 'string' || !safeEqual(provided, expected)) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  };
}

/** Constant-time string compare; length mismatch is a fast, safe reject. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false; // timingSafeEqual throws on length mismatch
  return timingSafeEqual(ab, bb);
}
