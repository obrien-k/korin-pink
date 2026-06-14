import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseStrictPodcast } from '../lib/rss_strict.js';
import { parsePlatformFeed, renderMinimalIrc } from '../lib/rss.js';

const InboundFeedSchema = z.object({
  xmlPayload: z.string().min(1, 'Payload cannot be blank'),
  templateType: z.enum(['podcast', 'minimal']),
  environment: z.object({
    osc8: z.boolean()
  })
});

export async function ircNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/irc/announce', async (request, reply) => {
    const parseResult = InboundFeedSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({ 
        error: 'Validation failed', 
        details: parseResult.error.format() 
      });
    }

    const { xmlPayload, templateType, environment } = parseResult.data;

    try {
      if (templateType === 'podcast') {
          const episodes = await parseStrictPodcast(xmlPayload);
          if (episodes.length === 0) {
            return reply.status(422).send({ error: 'Podcast feed does not contain any episodes' });
          }
          const data = episodes.map(ep => ({
            episode: ep.title,
            length: ep.duration,
            stream: ep.audioUrl,
            agenda: ep.timecodes
          }));
          return reply.send({
            status: 'ready',
            generator: 'Stellar Agent Substrate v1',
            data
          });
        } else {
        const artifacts = await parsePlatformFeed(xmlPayload);
        const newestArtifact = artifacts[0];

        if (!newestArtifact) {
          return reply.status(422).send({ error: 'Platform feed does not contain any valid artifacts' });
        }

        const singleLine = renderMinimalIrc(newestArtifact, environment.osc8);
        return reply.send({ success: true, mode: 'minimal', artifact: singleLine });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown compilation failure';
      return reply.status(500).send({ error: errorMessage });
    }
  });
}

// Alias expected by src/index.ts
export const ircRoutes = ircNotificationRoutes;
