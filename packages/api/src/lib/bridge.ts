/**
 * bridge.ts
 * Client for the irc-bridge's delivery endpoint (ADR-006).
 *
 * This is the ONLY api→bridge direction. Everything else between the two runs the
 * other way (the bridge POSTs /irc/metrics and /irc/verify, and GETs stellar-id),
 * so the shared IRC_BRIDGE_SECRET now authenticates both directions of one
 * boundary rather than one.
 *
 * Config is INJECTED and importing this module has no side effects; a missing
 * URL/secret fails at CALL time, matching lib/stellar.ts.
 */

import type { Config } from '../config.js';

type BridgeClientConfig = Pick<Config, 'ircBridgeUrl' | 'ircBridgeSecret'>;

/**
 * A line that did not reach the channel. `status` is what POST /irc/announce
 * should return to stellar — and stellar holds its announce cursor on any non-2xx,
 * re-pushing this item next cycle, so every one of these is retried in order.
 */
export class BridgeDeliveryError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BridgeDeliveryError';
  }
}

export interface BridgeClient {
  /** Post a line to a channel. Resolves on delivery; throws BridgeDeliveryError otherwise. */
  say(channel: string, message: string): Promise<void>;
  /**
   * Apply a private community's complete member set to its channel (ADR-007).
   * Resolves once applied; throws BridgeDeliveryError(503) otherwise.
   */
  setChannelAcl(channel: string, nicks: string[]): Promise<void>;
}

export function createBridgeClient(config: BridgeClientConfig): BridgeClient {
  /** One authenticated call to the bridge; every failure is a BridgeDeliveryError(503). */
  async function call(method: string, path: string, body: unknown): Promise<Response> {
    const { ircBridgeUrl, ircBridgeSecret } = config;
    if (!ircBridgeUrl || !ircBridgeSecret) {
      throw new BridgeDeliveryError(
        503,
        'irc-bridge delivery not configured (IRC_BRIDGE_URL / IRC_BRIDGE_SECRET)'
      );
    }
    try {
      return await fetch(`${ircBridgeUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-secret': ircBridgeSecret,
        },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new BridgeDeliveryError(503, `irc-bridge unreachable: ${detail}`);
    }
  }

  return {
    async say(channel: string, message: string): Promise<void> {
      const res = await call('POST', '/say', { channel, message });

      if (!res.ok) {
        // Every bridge-side refusal maps to 503, including the permanent ones
        // (channel not joined). That deliberately blocks stellar's cursor until
        // the misconfiguration is fixed, rather than skipping announces past it —
        // its contract is at-least-once and in-order, never skipping.
        throw new BridgeDeliveryError(503, `irc-bridge ${res.status}: ${await res.text()}`);
      }
    },

    async setChannelAcl(channel: string, nicks: string[]): Promise<void> {
      const res = await call('PUT', `/channels/${encodeURIComponent(channel)}/acl`, { nicks });
      if (!res.ok) {
        // The api validated the set already, so even a bridge 400 means the two
        // packages disagree — a bug, reported as 503 so stellar's next tick retries.
        throw new BridgeDeliveryError(503, `irc-bridge ${res.status}: ${await res.text()}`);
      }
    },
  };
}
