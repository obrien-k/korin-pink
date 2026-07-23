import { XMLParser } from 'fast-xml-parser';

export interface PodcastEpisode {
  title: string;
  link: string;
  summary: string;
  subtitle: string;
  audioUrl: string;
  duration: string;
  pubDate: string;
}

export interface PlatformArtifact {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category: 'contribution' | 'release' | 'contest' | 'announcement';
}

interface RawPodcastItem {
  title?: string;
  link?: string;
  'itunes:summary'?: string;
  'itunes:subtitle'?: string;
  enclosure?: { '@_url'?: string };
  'itunes:duration'?: string;
  pubDate?: string;
}

interface RawMinimalItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  category?: string;
}

const parserInstance = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

export async function parsePodcastFeed(xmlContent: string): Promise<PodcastEpisode[]> {
  const jsonObj = parserInstance.parse(xmlContent);
  const channel = jsonObj.rss?.channel;
  if (!channel) throw new Error('Invalid feed: missing RSS channel node.');

  const rawItems: RawPodcastItem[] = channel.item 
    ? (Array.isArray(channel.item) ? channel.item : [channel.item]) 
    : [];

  return rawItems.map((item) => ({
    title: item.title || 'Untitled Episode',
    link: item.link || channel.link || '',
    summary: item['itunes:summary'] || '',
    subtitle: item['itunes:subtitle'] || '',
    audioUrl: item.enclosure?.['@_url'] || '',
    duration: item['itunes:duration'] || '00:00',
    pubDate: item.pubDate || ''
  }));
}

export async function parsePlatformFeed(xmlContent: string): Promise<PlatformArtifact[]> {
  const jsonObj = parserInstance.parse(xmlContent);
  const channel = jsonObj.rss?.channel;
  if (!channel) throw new Error('Invalid feed: missing RSS channel node.');

  const rawItems: RawMinimalItem[] = channel.item 
    ? (Array.isArray(channel.item) ? channel.item : [channel.item]) 
    : [];

  return rawItems.map((item) => {
    const rawCategory = (item.category || 'announcement').toLowerCase();
    let validCategory: PlatformArtifact['category'] = 'announcement';
    if (['contribution', 'release', 'contest', 'announcement'].includes(rawCategory)) {
      validCategory = rawCategory as PlatformArtifact['category'];
    }

    return {
      title: item.title || 'New Notification',
      link: item.link || channel.link || '',
      description: item.description || '',
      pubDate: item.pubDate || '',
      category: validCategory
    };
  });
}

export function renderPodcastIrc(episode: PodcastEpisode, supportsOsc8: boolean): string {
  const cTeal = '\x1b[38;2;52;211;153m';
  const cCyan = '\x1b[38;2;34;211;238m';
  const cReset = '\x1b[0m';
  const cBold = '\x1b[1m';

  let titleLine = `${cBold}${cCyan}${episode.title}${cReset}`;
  if (supportsOsc8 && episode.link) {
    titleLine = `\x1b]8;;${episode.link}\x1b\\${cBold}${cCyan}${episode.title}${cReset}\x1b]8;;\x1b\\`;
  }

  return [
    `${cBold}${cTeal}🎙️ PODCAST${cReset} ── ${titleLine} (${episode.duration})`,
    `  ${episode.subtitle ? `"${episode.subtitle}"` : ''}`,
    episode.audioUrl ? `  \x1b[30;1mStream URL:\x1b[0m \x1b[4m${episode.audioUrl}\x1b[0m` : ''
  ].filter(Boolean).join('\n');
}

export function renderMinimalIrc(artifact: PlatformArtifact, supportsOsc8: boolean): string {
  const cTeal = '\x1b[38;2;52;211;153m';
  const cCyan = '\x1b[38;2;34;211;238m';
  const cBlue = '\x1b[38;2;59;130;246m';
  const cReset = '\x1b[0m';
  const cBold = '\x1b[1m';

  const categoryIcons: Record<PlatformArtifact['category'], string> = {
    contribution: '🎁',
    release: '🚀',
    contest: '🏆',
    announcement: '📢'
  };

  const badgeColor = artifact.category === 'contest' ? cTeal : artifact.category === 'release' ? cCyan : cBlue;
  const icon = categoryIcons[artifact.category];

  let clickableTitle = `${cBold}${artifact.title}${cReset}`;
  if (supportsOsc8 && artifact.link) {
    clickableTitle = `\x1b]8;;${artifact.link}\x1b\\${cBold}${cCyan}${artifact.title}${cReset}\x1b]8;;\x1b\\`;
  }

  return `${cBold}${badgeColor}${icon} [${artifact.category.toUpperCase()}]${cReset} ${clickableTitle} ── ${artifact.description}`;
}

// irc-framework splits an over-length message and emits ONE PRIVMSG PER BLOCK, so
// an unbounded contributor-authored title becomes a multi-message flood from an
// opered bot. 350 is the framework's message_max_length default; the margin leaves
// room for the prefix the server prepends when relaying to the channel.
const IRC_LINE_MAX_BYTES = 320;

/**
 * The line korin posts to a channel (ADR-006). Plain text, always carries the URL.
 *
 * Deliberately NOT renderMinimalIrc: that one renders for a terminal — 24-bit ANSI
 * colour and OSC-8 hyperlinks — and references artifact.link only inside its osc8
 * branch, which its only caller disables. Its output is an HTTP response body and
 * stays that way; this is the IRC-facing rendering.
 */
export function renderIrcAnnounce(artifact: PlatformArtifact): string {
  const tag = `[${artifact.category.toUpperCase()}]`;
  const link = sanitizeIrcText(artifact.link);
  // Tag and link are load-bearing — the notification and the thing it points at.
  // Only the title gives ground when the line exceeds the budget.
  const fixedBytes = Buffer.byteLength(`${tag}  - ${link}`);
  const title = truncateBytes(
    sanitizeIrcText(artifact.title),
    Math.max(0, IRC_LINE_MAX_BYTES - fixedBytes)
  );
  return `${tag} ${title} - ${link}`;
}

/**
 * Strip control characters from contributor-authored text. Newlines are the point:
 * irc-framework turns each one into a separate PRIVMSG, making them a flood vector
 * rather than a formatting nuisance. The range also covers \x02/\x03, so a title
 * cannot smuggle in IRC bold/colour codes.
 */
function sanitizeIrcText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Truncate to a byte budget without splitting a multi-byte character. */
function truncateBytes(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value;

  const ellipsis = '…';
  const budget = maxBytes - Buffer.byteLength(ellipsis);
  if (budget <= 0) return '';

  const buf = Buffer.from(value);
  // Back off to a UTF-8 boundary — continuation bytes are 10xxxxxx.
  let end = budget;
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8') + ellipsis;
}
