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
