import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function aiRoutes(app: FastifyInstance) {
  app.post('/ai/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ result: 'mock generated text' });
  });

  app.post('/ai/summarize', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ result: 'mock summary' });
  });

  app.get('/ai/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ streamUrl: 'mock stream' });
  });
}
