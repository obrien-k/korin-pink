// Phrases in Ergo's stderr log that indicate a ban-worthy event. Single source
// of truth so the runtime matcher and the rendered fail2ban filter stay in sync.
const BAN_PHRASES = ['failed login', 'rejecting connection', 'too many connections'];
const BAN_SIGNALS = BAN_PHRASES.map((p) => new RegExp(p, 'i'));

const IPV4 = /(\d{1,3}(?:\.\d{1,3}){3})/;

/** fail2ban failregex lines (one per signal), capturing the offender as <HOST>. */
export function fail2banFailregex(): string[] {
  return BAN_PHRASES.map((p) => `^.*${p}.*?<HOST>`);
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
