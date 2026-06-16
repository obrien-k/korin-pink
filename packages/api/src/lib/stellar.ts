/**
 * stellar.ts
 * Client for stellar-api. korin.pink is downstream of Stellar; the IRC metrics
 * flow is PULL (stellar polls korin's GET /irc/metrics) and announce is PUSH
 * (stellar POSTs release RSS to korin's POST /irc/announce). korin does NOT push
 * metrics to stellar — see stellar-api ADR-0013 §Integration contract.
 *
 * This client covers the korin→stellar calls only: resolving a nick to its
 * Stellar account, linking a nick, and reading a user's CRS. All are
 * authenticated with the shared service key (Bearer STELLAR_API_KEY).
 *
 * Config is INJECTED — importing this module has no side effects and never
 * throws (it used to throw at import, crashing any test that imported a route).
 * A missing URL/key fails at CALL time with a clear message. Wired-for-later:
 * no korin route consumes this yet (ADR-0013 anticipates the nick→account path).
 */

import type { Config } from '../config.js'

export interface StellarUser {
  id: number
  username: string
  ircNick?: string | null
}

type StellarConfig = Pick<Config, 'stellarApiUrl' | 'stellarApiKey'>

export interface StellarClient {
  getUserByNick(nick: string): Promise<StellarUser | null>
  linkNick(stellarUserId: number, ircNick: string | null): Promise<void>
  getReputation(stellarUserId: number): Promise<unknown>
}

/** Build the korin→stellar client from injected config. */
export function createStellarClient(config: StellarConfig): StellarClient {
  async function stellarFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const { stellarApiUrl, stellarApiKey } = config
    if (!stellarApiUrl || !stellarApiKey) {
      throw new Error('stellar client not configured (STELLAR_API_URL / STELLAR_API_KEY)')
    }
    const res = await fetch(`${stellarApiUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stellarApiKey}`,
        ...init?.headers,
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`stellar-api ${res.status} @ ${path}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  return {
    // Look up a Stellar user by their registered IRC nick.
    async getUserByNick(nick) {
      try {
        return await stellarFetch<StellarUser>(`/api/users/by-irc-nick/${encodeURIComponent(nick)}`)
      } catch {
        return null
      }
    },
    // Register / update an IRC nick on a Stellar account.
    async linkNick(stellarUserId, ircNick) {
      await stellarFetch(`/api/users/${stellarUserId}/irc-nick`, {
        method: 'PUT',
        body: JSON.stringify({ ircNick }),
      })
    },
    // Fetch current CRS for display/context — read-only, not used in scoring.
    getReputation(stellarUserId) {
      return stellarFetch(`/api/users/${stellarUserId}/reputation`)
    },
  }
}
