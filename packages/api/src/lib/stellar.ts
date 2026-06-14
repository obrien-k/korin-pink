/**
 * stellar.ts
 * Client for stellar-api. Responsible for:
 *  - Resolving Stellar userId ↔ IRC nick mappings
 *  - Reporting IRCScore signals (presence, messages, channelQuality)
 *  - Pulling user reputation context when needed
 *
 * IRCScore (per PRD v0.0.4) feeds CommunityValueIndex:
 *   IRCScore = activity * consistency * channelQuality
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
  id: string
  username: string
  ircNick?: string
}

/** Signals reported per-user per-flush cycle to stellar-api */
export interface IRCMetricPayload {
  stellarUserId: string
  nick:           string
  // raw signals — stellar-api owns the weighting formula
  presenceSeconds:  number   // total seconds online in window
  messageCount:     number
  channelCount:     number   // unique channels participated in
  windowStart:      string   // ISO
  windowEnd:        string   // ISO
}

export interface IRCMetricResponse {
  accepted: boolean
  ircScore?: number   // stellar-api may return computed score
}

// ── API calls ────────────────────────────────────────────────────────────────

/** Look up a Stellar user by their registered IRC nick */
export async function getUserByNick(nick: string): Promise<StellarUser | null> {
  try {
    return await stellarFetch<StellarUser>(`/users/by-irc-nick/${encodeURIComponent(nick)}`)
  } catch {
    return null
  }
}

/** Register / update an IRC nick on a Stellar account */
export async function linkNick(stellarUserId: string, nick: string): Promise<void> {
  await stellarFetch(`/users/${stellarUserId}/irc-nick`, {
    method: 'PUT',
    body: JSON.stringify({ nick }),
  })
}

/**
 * Flush accumulated IRC metrics to stellar-api.
 * Called by irc-bridge on a scheduled interval (e.g. every 15 min).
 * stellar-api applies the weighting and updates IRCScore component of CRS.
 */
export async function flushIRCMetrics(
  metrics: IRCMetricPayload[]
): Promise<IRCMetricResponse[]> {
  return stellarFetch<IRCMetricResponse[]>('/reputation/irc-metrics', {
    method: 'POST',
    body: JSON.stringify({ metrics }),
  })
}

/** Fetch current CRS for display/context — not used in scoring, read-only */
export async function getReputation(stellarUserId: string) {
  return stellarFetch(`/users/${stellarUserId}/reputation`)
}
