import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function mailRoutes(app: FastifyInstance) {
  app.post('/mail/send', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  app.get('/mail/inbox', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ messages: [] });
  });
}
