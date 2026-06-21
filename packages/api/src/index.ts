import { loadConfig } from './config.js';
import { buildServer } from './server.js';

// Resolve config once, at boot — fails fast on a malformed env, never at import.
const config = loadConfig();
const server = buildServer(config);

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
