import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function filesRoutes(app: FastifyInstance) {
  app.get('/files', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ files: [] });
  });

  app.post('/files/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  app.get('/files/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ buffer: 'mock data' });
  });
}
