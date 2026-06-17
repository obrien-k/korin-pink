import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireSharedSecret } from '../lib/auth.js';
import { parseStrictPodcast } from '../lib/rss_strict.js';
import { parsePlatformFeed, renderMinimalIrc } from '../lib/rss.js';
import { createStellarClient } from '../lib/stellar.js';

// ---------------------------------------------------------------------------
// IRC metrics — shared types
// ---------------------------------------------------------------------------

export interface UserMetrics {
  nick: string;
  stellarId?: string;
  presenceSeconds: number;
  messageCount: number;
  channelCount: number;
  channels: string[];
  windowStart: number; // unix epoch ms
  windowEnd: number;
}

// In-process store for the most recent flush from the irc-bridge.
// stellar-api polls GET /irc/metrics and consumes this.
let metricsStore: UserMetrics[] = [];
let lastFlushAt: number | null = null;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MetricsFlushSchema = z.object({
  users: z.array(
    z.object({
      nick: z.string().min(1),
      stellarId: z.string().optional(),
      presenceSeconds: z.number().int().nonnegative(),
      messageCount: z.number().int().nonnegative(),
      channelCount: z.number().int().nonnegative(),
      channels: z.array(z.string()),
      windowStart: z.number().int().positive(),
      windowEnd: z.number().int().positive(),
    })
  ),
});

// Nick Verification relay (stellar-api ADR-0015). The bridge forwards the
// authenticated IRC sender nick + the code it received over a private query.
export const VerifyRelaySchema = z.object({
  nick: z.string().min(1),
  code: z.string().min(1),
});

const InboundFeedSchema = z.object({
  xmlPayload: z.string().min(1, 'Payload cannot be blank'),
  templateType: z.enum(['podcast', 'minimal']),
  environment: z.object({
    osc8: z.boolean()
  })
});

export async function ircNotificationRoutes(app: FastifyInstance): Promise<void> {
  // stellar-api pushes release RSS here (ADR-0013 §Integration contract),
  // presenting the shared pull key. Auth is the one shared-secret guard.
  app.post('/irc/announce', {
    preHandler: requireSharedSecret('x-pull-key', app.config.stellarPullKey),
  }, async (request, reply) => {
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

// ---------------------------------------------------------------------------
// IRC metrics routes
// ---------------------------------------------------------------------------

async function ircMetricsRoutes(app: FastifyInstance): Promise<void> {
  // POST /irc/metrics — irc-bridge pushes a flush window here
  app.post('/irc/metrics', {
    preHandler: requireSharedSecret('x-bridge-secret', app.config.ircBridgeSecret),
  }, async (request, reply) => {
    const result = MetricsFlushSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation failed', details: result.error.format() });
    }

    metricsStore = result.data.users;
    lastFlushAt = Date.now();

    return reply.send({ ok: true, accepted: metricsStore.length });
  });

  // GET /irc/metrics — stellar-api polls this
  app.get('/irc/metrics', {
    preHandler: requireSharedSecret('x-pull-key', app.config.stellarPullKey),
  }, async (_request, reply) => {
    return reply.send({ users: metricsStore, lastFlushAt });
  });

  // POST /irc/verify — the bridge relays a "!verify <code>" it saw in a private
  // query. korin is a stateless pass-through to stellar (ADR-0015); stellar owns
  // the (nick, code) match and the promotion to the Verified IRC Link. `nick` is
  // the authenticated IRC sender — the binding that makes the code unstealable.
  app.post('/irc/verify', {
    preHandler: requireSharedSecret('x-bridge-secret', app.config.ircBridgeSecret),
  }, async (request, reply) => {
    const result = VerifyRelaySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation failed', details: result.error.format() });
    }

    const stellar = createStellarClient(app.config);
    try {
      const outcome = await stellar.verifyNick(result.data.nick, result.data.code);
      return reply.send(outcome);
    } catch (err: unknown) {
      // Transport/auth failure — stellar never saw it, so the code is NOT consumed
      // (ADR-0015: a relay error leaves the still-valid code usable on retry).
      const message = err instanceof Error ? err.message : 'stellar verify call failed';
      request.log.warn({ err: message }, 'irc/verify relay to stellar failed');
      return reply.status(502).send({ verified: false, reason: 'Verification service unavailable, try again' });
    }
  });
}

// Alias expected by src/index.ts
export const ircRoutes = ircNotificationRoutes;
export { ircMetricsRoutes };
