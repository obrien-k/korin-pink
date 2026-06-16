// Phrases in Ergo's log that indicate abuse. Single source of truth so the
// runtime matcher and the rendered fail2ban filter stay in sync. Validated
// against real Ergo 2.18 output on the live deploy (issue #19).
//
// BANNABLE: lines the `connect-ip` subsystem logs WITH the client IP. Only these
// can feed fail2ban (it needs a <HOST> on the matched line). The exact rejection
// wording still needs confirmation from a real connection flood — see issue #19.
const BANNABLE_PHRASES = ['rejecting connection', 'too many connections'];

// DETECT-ONLY: real abuse events Ergo logs WITHOUT an IP — the `opers`/`accounts`
// subsystems log the nick + session id, not the source IP, e.g.
//   opers : OPER attempt for : <nick> : failed with invalid password
// fail2ban has no <HOST> to ban on these, so they stay OUT of the failregex; the
// runtime matcher still recognises them (visibility / future session->IP work).
const DETECT_ONLY_PHRASES = ['invalid password'];

const BAN_SIGNALS = [...BANNABLE_PHRASES, ...DETECT_ONLY_PHRASES].map((p) => new RegExp(p, 'i'));

const IPV4 = /(\d{1,3}(?:\.\d{1,3}){3})/;

/** fail2ban failregex lines (one per bannable signal), capturing the offender as <HOST>. */
export function fail2banFailregex(): string[] {
  return BANNABLE_PHRASES.map((p) => `^.*${p}.*?<HOST>`);
}

/**
 * Given one Ergo log line, return the offending source IP if the line signals
 * an abusive event (auth failure, connection flood), otherwise null.
 * This mirrors the fail2ban failregex so the two stay in sync and testable.
 */
export function extractBanIp(line: string): string | null {
  if (!BAN_SIGNALS.some((re) => re.test(line))) return null;
  const m = line.match(IPV4);
  return m ? m[1] : null;
}
