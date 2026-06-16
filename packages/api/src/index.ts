import Fastify from 'fastify';
import { loadConfig, type Config } from './config.js';
import { ircRoutes, ircMetricsRoutes } from './routes/irc.js';
import { filesRoutes } from './routes/files.js';
import { wikiRoutes } from './routes/wiki.js';
import { aiRoutes } from './routes/ai.js';
import { mailRoutes } from './routes/mail.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

// Resolve config once, at boot — fails fast on a malformed env, never at import.
const config = loadConfig();

const server = Fastify({
  logger: true
});
server.decorate('config', config);

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
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
