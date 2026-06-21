/**
 * Nick → Stellar account resolution (ADR-0013).
 *
 * The bridge attributes a member's IRC activity to their Stellar account by
 * asking korin to resolve the nick. korin returns a stable shape — stellarId is
 * a string when linked, null when not — so we only branch on the body. A
 * non-200 throws, so the caller leaves the nick unresolved and retries on the
 * next sighting rather than mislinking. Injectable fetch for testing.
 */

export interface StellarIdResponse {
  nick: string;
  stellarId: string | null;
}

export async function fetchStellarId(
  apiUrl: string,
  bridgeSecret: string,
  nick: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchImpl(`${apiUrl}/irc/users/${encodeURIComponent(nick)}/stellar-id`, {
    headers: { 'x-bridge-secret': bridgeSecret },
  });
  if (!res.ok) {
    throw new Error(`korin stellar-id ${res.status}`);
  }
  const body = (await res.json()) as StellarIdResponse;
  return body.stellarId;
}
