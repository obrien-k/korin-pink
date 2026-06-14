import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function wikiRoutes(app: FastifyInstance) {
  app.get('/wiki', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ articles: [] });
  });

  app.post('/wiki', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  app.post('/wiki/:slug/ai-expand', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, expandedContent: 'mock expansion' });
  });
}
