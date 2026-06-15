import Fastify from 'fastify';
import { ircRoutes, ircMetricsRoutes } from './routes/irc.js';
import { filesRoutes } from './routes/files.js';
import { wikiRoutes } from './routes/wiki.js';
import { aiRoutes } from './routes/ai.js';
import { mailRoutes } from './routes/mail.js';

const server = Fastify({
  logger: true
});

server.register(ircRoutes);
server.register(ircMetricsRoutes);
server.register(filesRoutes);
server.register(wikiRoutes);
server.register(aiRoutes);
server.register(mailRoutes);

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
