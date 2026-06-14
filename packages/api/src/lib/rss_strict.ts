import { XMLParser } from 'fast-xml-parser';

export interface TimecodeMarker {
  timestamp: string;
  topic: string;
  links: string[];
}

export interface StrictPodcastEpisode {
  title: string;
  link: string;
  author: string;
  subtitle: string;
  summary: string;
  timecodes: TimecodeMarker[];
  audioUrl: string;
  audioLengthBytes: number;
  audioType: string;
  duration: string;
  pubDate: string;
}

const strictParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true
});

/**
 * Utility to decode basic XML entities and pull structured timecodes from raw text
 */
function extractAgentTimecodes(summaryText: string): TimecodeMarker[] {
  const markers: TimecodeMarker[] = [];
  const lines = summaryText.split('\n');
  
  // Regular expression matching structural stamps: e.g., "06:30 - Title" or "1:02:00 - Title"
  const timecodeRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(.*)$/;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  let currentMarker: TimecodeMarker | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(timecodeRegex);

    if (match) {
      if (currentMarker) markers.push(currentMarker);
      currentMarker = {
        timestamp: match[1],
        topic: match[2].replace(/&quot;/g, '"').replace(/&#x27;/g, "'"),
        links: []
      };
    } else if (currentMarker && urlRegex.test(trimmed)) {
      const foundUrls = trimmed.match(urlRegex);
      if (foundUrls) currentMarker.links.push(...foundUrls);
    }
  }

  if (currentMarker) markers.push(currentMarker);
  return markers;
}

/**
 * Template A: Decodes strict Apple Podcast XML/RSS formats
 */
export async function parseStrictPodcast(xmlContent: string): Promise<StrictPodcastEpisode[]> {
  const jsonTree = strictParser.parse(xmlContent);
  const channel = jsonTree.rss?.channel;
  
  if (!channel) {
    throw new Error('W3C Validation Error: Invalid RSS payload structure. Missing root channel block.');
  }

  const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];

  return items.map((item: any) => {
    const rawSummary = item['itunes:summary'] || '';
    
    return {
      title: item.title || 'Untitled Episode',
      link: item.link || channel.link || '',
      author: item['itunes:author'] || channel['itunes:author'] || 'Unknown Author',
      subtitle: item['itunes:subtitle'] || '',
      summary: rawSummary,
      timecodes: extractAgentTimecodes(rawSummary),
      audioUrl: item.enclosure?.['@_url'] || '',
      audioLengthBytes: parseInt(item.enclosure?.['@_length'] || '0', 10),
      audioType: item.enclosure?.['@_type'] || 'audio/mpeg',
      duration: item['itunes:duration'] || '00:00',
      pubDate: item.pubDate || ''
    };
  });
}
