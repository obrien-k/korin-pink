import Fastify from 'fastify';
import { ircRoutes } from './routes/irc.js';

const server = Fastify({
  logger: true
});

server.register(ircRoutes);

server.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`Server listening on port 3000`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
