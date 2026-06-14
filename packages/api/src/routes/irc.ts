import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const metricSchema = z.object({
  stellarUserId: z.string(),
  nick: z.string(),
  presenceSeconds: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  channels: z.array(z.string()).optional(),
  lastSeen: z.string().optional()
});

const metricsArraySchema = z.array(metricSchema);

type MetricPayload = z.infer<typeof metricsArraySchema>;

// In-memory store (to be flushed when stellar-api pulls)
let metricsStore: MetricPayload = [];

export async function ircRoutes(app: FastifyInstance) {
  // Bridge -> API (internal push)
  app.post('/irc/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const bridgeSecret = request.headers['x-bridge-secret'];
    if (bridgeSecret !== process.env.IRC_BRIDGE_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized bridge' });
    }

    try {
      const parsed = metricsArraySchema.parse(request.body);
      metricsStore.push(...parsed);
      return reply.status(200).send({ success: true, count: parsed.length });
    } catch (e) {
      return reply.status(400).send({ error: 'Invalid payload schema', details: e });
    }
  });

  // stellar-api -> API (external pull)
  app.get('/irc/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const pullKey = request.headers['x-api-key'];
    if (pullKey !== process.env.STELLAR_PULL_KEY) {
      return reply.status(401).send({ error: 'Unauthorized pull' });
    }

    const query = request.query as { flush?: string };
    const currentMetrics = [...metricsStore];

    if (query.flush === 'true') {
      metricsStore = [];
    }

    return reply.status(200).send({
      metrics: currentMetrics,
      ts: new Date().toISOString()
    });
  });
}
