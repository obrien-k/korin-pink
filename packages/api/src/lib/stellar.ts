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
 */

const STELLAR_API_BASE = process.env.STELLAR_API_URL
const STELLAR_API_KEY  = process.env.STELLAR_API_KEY

if (!STELLAR_API_BASE) throw new Error('STELLAR_API_URL is required')
if (!STELLAR_API_KEY)  throw new Error('STELLAR_API_KEY is required')

async function stellarFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${STELLAR_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STELLAR_API_KEY}`,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`stellar-api ${res.status} @ ${path}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface StellarUser {
  id: number
  username: string
  ircNick?: string | null
}

// ── API calls (paths per stellar-api ADR-0013 §Integration contract) ──────────

/** Look up a Stellar user by their registered IRC nick. */
export async function getUserByNick(nick: string): Promise<StellarUser | null> {
  try {
    return await stellarFetch<StellarUser>(`/api/users/by-irc-nick/${encodeURIComponent(nick)}`)
  } catch {
    return null
  }
}

/** Register / update an IRC nick on a Stellar account. */
export async function linkNick(stellarUserId: number, ircNick: string | null): Promise<void> {
  await stellarFetch(`/api/users/${stellarUserId}/irc-nick`, {
    method: 'PUT',
    body: JSON.stringify({ ircNick }),
  })
}

/** Fetch current CRS for display/context — read-only, not used in scoring. */
export async function getReputation(stellarUserId: number) {
  return stellarFetch(`/api/users/${stellarUserId}/reputation`)
}
