type Item = { label: string; url?: string };
type LinkMode = "plain" | "osc8";

// Simple OSC‑8 hyperlink builder (BEL‑terminated) – works on iTerm2, Pi TUI, etc.
const osc8 = (url: string, label: string) => `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;

/** Render a status strip item.
 *  - plain: "label — url"
 *  - osc8 : clickable label with arrow, fallback plain if terminal unsupported.
 */
export function renderStrip(item: Item, mode: LinkMode = "plain"): string {
  if (!item.url) return item.label;
  return mode === "osc8"
    ? `${osc8(item.url, item.label)} ↗`
    : `${item.label} — ${item.url}`;
}

/** Minimal corpus mapping tier → example item.
 *  In a real deployment you would expand this list.
 */
const corpus: Record<string, Item> = {
  light: { label: "💃Breakdancing🕺", url: "https://www.youtube.com/watch?v=Hr95rKEYT5E" },
  medium: { label: "⚡It's Pikachu!", url: "https://www.youtube.com/watch?v=5QzEoWeybp4" },
  sweet: { label: "Conversion, software version 🥁 7.0", url: "https://www.youtube.com/watch?v=iywaBOMvYLI&list=RDiywaBOMvYLI&start_radio=1" },
  heavy: { label: "We're no strangers to love..", url: "https://www.youtube.com/watch?v=eBGIQ7ZuuiU" },
};

/** Get a ready‑to‑display strip for a tier. */
export function stripForTier(tier: "silent" | "light" | "medium" | "sweet" | "heavy", mode: LinkMode = "plain"): string {
  if (tier === "silent") return "";
  const item = corpus[tier];
  return item ? renderStrip(item, mode) : "";
}
