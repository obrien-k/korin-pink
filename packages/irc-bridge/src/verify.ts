/**
 * Nick Verification command handling (stellar-api ADR-0015).
 *
 * Pure, side-effect-free helpers so they're testable without booting the IRC
 * client. The bridge only ever acts on a `!verify <code>` sent in a *private
 * query* to the bot — never a channel message — so a code is never leaked into
 * a channel, and the command is control-plane (not counted as IRCScore activity).
 */

export interface VerifyOutcome {
  verified: boolean;
  reason?: string;
}

/**
 * Parse a `!verify <code>` command. Returns the code, or null if the message is
 * not a well-formed verify command (case-insensitive; exactly one argument).
 */
export function parseVerifyCommand(message: string): string | null {
  const match = message.trim().match(/^!verify\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** The private reply the bot whispers back to the member for a verify outcome. */
export function formatVerifyReply(nick: string, outcome: VerifyOutcome): string {
  return outcome.verified
    ? `✓ Verified — ${nick} is now linked to your Stellar account.`
    : `✗ ${outcome.reason ?? 'Verification failed.'}`;
}

/** Whispered when korin/stellar can't be reached — the code stays usable. */
export const VERIFY_UNAVAILABLE =
  'Verification is temporarily unavailable — try again shortly.';
