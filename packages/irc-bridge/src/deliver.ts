/**
 * deliver.ts — the bridge's inbound HTTP surface (ADR-006).
 *
 * The bridge is otherwise a pure client: it dials IRC and POSTs to korin. This is
 * the one thing that listens, and it exists because the announce POST lands on the
 * `api` service while the IRC socket lives here.
 *
 * Split in two on purpose: handleDeliverRequest is pure and carries every rule, so
 * the auth/validation/status behaviour is testable without binding a port;
 * createDeliverServer is the thin node:http shell. node:http rather than a
 * framework — the bridge has exactly one dependency and one route does not earn a
 * second.
 */

import { createServer, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { DeliverOutcome } from './bridge.js';

/** Announce lines are one PRIVMSG; anything near this size is not a real request. */
const MAX_BODY_BYTES = 8 * 1024;

export interface DeliverHttpDeps {
  /** Shared secret (IRC_BRIDGE_SECRET). Unset rejects every request — fail closed. */
  secret: string;
  deliver(channel: string, message: string): DeliverOutcome;
}

export interface DeliverHttpRequest {
  method: string | undefined;
  path: string;
  secret: string | string[] | undefined;
  rawBody: string;
}

export interface DeliverHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

export function handleDeliverRequest(
  req: DeliverHttpRequest,
  deps: DeliverHttpDeps
): DeliverHttpResponse {
  if (req.method !== 'POST' || req.path !== '/say') {
    return { status: 404, body: { error: 'Not found' } };
  }

  // Mirrors the api's requireSharedSecret: constant-time, and an unset expected
  // secret always rejects.
  if (!deps.secret || typeof req.secret !== 'string' || !safeEqual(req.secret, deps.secret)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(req.rawBody);
  } catch {
    return { status: 400, body: { error: 'Invalid JSON' } };
  }

  const { channel, message } = (parsed ?? {}) as { channel?: unknown; message?: unknown };
  if (typeof channel !== 'string' || !channel || typeof message !== 'string' || !message) {
    return { status: 400, body: { error: 'channel and message are required non-empty strings' } };
  }

  const outcome = deps.deliver(channel, message);
  if (outcome.ok) return { status: 200, body: { ok: true } };

  // 400 for not-joined (permanent: korin named a channel this bridge isn't in),
  // 503 for not-connected (transient: the socket is down or mid-reconnect).
  return outcome.reason === 'not-joined'
    ? { status: 400, body: { error: `bridge has not joined ${channel}` } }
    : { status: 503, body: { error: 'bridge is not connected to IRC' } };
}

export function createDeliverServer(deps: DeliverHttpDeps): Server {
  return createServer((req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        respond(res, { status: 413, body: { error: 'Payload too large' } });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (rejected) return;
      respond(
        res,
        handleDeliverRequest(
          {
            method: req.method,
            // Parsed against a dummy origin purely to strip any query string.
            path: new URL(req.url ?? '/', 'http://irc-bridge').pathname,
            secret: req.headers['x-bridge-secret'],
            rawBody: Buffer.concat(chunks).toString('utf8'),
          },
          deps
        )
      );
    });

    req.on('error', (err) => {
      console.error('[bridge] deliver request error:', err);
      if (!rejected && !res.headersSent) {
        respond(res, { status: 400, body: { error: 'Request error' } });
      }
    });
  });
}

function respond(res: ServerResponse, result: DeliverHttpResponse): void {
  const payload = JSON.stringify(result.body);
  res.writeHead(result.status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Constant-time compare; length mismatch is a fast, safe reject. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false; // timingSafeEqual throws on length mismatch
  return timingSafeEqual(ab, bb);
}
