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
 * framework — the bridge has exactly one dependency, and two routes do not earn a
 * second.
 *
 * Two routes:
 * - `POST /say` delivers one line (ADR-006).
 * - `PUT /channels/:channel/acl` applies a private community's membership
 *   projection (ADR-007).
 */

import { createServer, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { DeliverOutcome } from './bridge.js';
import type { AclOutcome } from './acl.js';

/**
 * A projection of MAX_ACL_NICKS 32-byte nicks is about 36 KB as JSON; an announce
 * line is one PRIVMSG. Anything past this is not a real request.
 */
const MAX_BODY_BYTES = 64 * 1024;

export interface DeliverHttpDeps {
  /** Shared secret (IRC_BRIDGE_SECRET). Unset rejects every request — fail closed. */
  secret: string;
  deliver(channel: string, message: string): DeliverOutcome;
  applyAcl(channel: string, nicks: string[]): Promise<AclOutcome>;
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

const ACL_PATH = /^\/channels\/([^/]+)\/acl$/;

export async function handleBridgeRequest(
  req: DeliverHttpRequest,
  deps: DeliverHttpDeps
): Promise<DeliverHttpResponse> {
  const acl = ACL_PATH.exec(req.path);
  if (req.method === 'PUT' && acl) return handleAclRequest(req, deps, acl[1]);
  return handleDeliverRequest(req, deps);
}

function authorized(req: DeliverHttpRequest, deps: DeliverHttpDeps): boolean {
  // Mirrors the api's requireSharedSecret: constant-time, and an unset expected
  // secret always rejects.
  return !!deps.secret && typeof req.secret === 'string' && safeEqual(req.secret, deps.secret);
}

function parseJson(rawBody: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(rawBody) };
  } catch {
    return { ok: false };
  }
}

/**
 * PUT /channels/:channel/acl — `{ nicks: string[] }`, the complete member set
 * (ADR-007). The bridge re-checks the channel pattern and every nick itself
 * rather than trusting the api: each nick becomes text in a raw MODE or KICK.
 */
async function handleAclRequest(
  req: DeliverHttpRequest,
  deps: DeliverHttpDeps,
  encodedChannel: string
): Promise<DeliverHttpResponse> {
  if (!authorized(req, deps)) return { status: 401, body: { error: 'Unauthorized' } };

  let channel: string;
  try {
    channel = decodeURIComponent(encodedChannel);
  } catch {
    return { status: 400, body: { error: 'Invalid channel' } };
  }

  const parsed = parseJson(req.rawBody);
  if (!parsed.ok) return { status: 400, body: { error: 'Invalid JSON' } };
  const { nicks } = (parsed.value ?? {}) as { nicks?: unknown };
  if (!Array.isArray(nicks) || !nicks.every((n) => typeof n === 'string')) {
    return { status: 400, body: { error: 'nicks must be an array of strings' } };
  }

  const outcome = await deps.applyAcl(channel, nicks);
  if (outcome.ok) return { status: 204, body: {} };
  switch (outcome.reason) {
    case 'invalid-channel':
      return { status: 400, body: { error: 'channel must be #c-<community id>' } };
    case 'invalid-nicks':
      return { status: 400, body: { error: 'nicks must be valid IRC nicks, at most 1000' } };
    default:
      // Every other reason is the bridge's or Ergo's state, not the request's:
      // not connected, not opered, no op, a refused REGISTER, or a timeout.
      return { status: 503, body: { error: `projection not applied: ${outcome.reason}` } };
  }
}

export function handleDeliverRequest(
  req: DeliverHttpRequest,
  deps: DeliverHttpDeps
): DeliverHttpResponse {
  if (req.method !== 'POST' || req.path !== '/say') {
    return { status: 404, body: { error: 'Not found' } };
  }

  if (!authorized(req, deps)) return { status: 401, body: { error: 'Unauthorized' } };

  const json = parseJson(req.rawBody);
  if (!json.ok) return { status: 400, body: { error: 'Invalid JSON' } };
  const parsed = json.value;

  const { channel, message } = (parsed ?? {}) as { channel?: unknown; message?: unknown };
  if (typeof channel !== 'string' || !channel || typeof message !== 'string' || !message) {
    return { status: 400, body: { error: 'channel and message are required non-empty strings' } };
  }

  const outcome = deps.deliver(channel, message);
  if (outcome.ok) return { status: 200, body: { ok: true } };

  // 400 for not-joined (permanent: korin named a channel this bridge isn't in).
  // 503 for the transient ones: a #c-N not projected yet (ADR-007), or the socket
  // down or mid-reconnect.
  if (outcome.reason === 'not-joined') {
    return { status: 400, body: { error: `bridge has not joined ${channel}` } };
  }
  return outcome.reason === 'not-projected'
    ? { status: 503, body: { error: `${channel} has not been projected yet` } }
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
      handleBridgeRequest(
        {
          method: req.method,
          // Parsed against a dummy origin purely to strip any query string.
          path: new URL(req.url ?? '/', 'http://irc-bridge').pathname,
          secret: req.headers['x-bridge-secret'],
          rawBody: Buffer.concat(chunks).toString('utf8'),
        },
        deps
      )
        .then((result) => respond(res, result))
        .catch((err: unknown) => {
          console.error('[bridge] request failed:', err);
          if (!res.headersSent) respond(res, { status: 500, body: { error: 'Internal error' } });
        });
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
  if (result.status === 204) {
    res.writeHead(204);
    res.end();
    return;
  }
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
