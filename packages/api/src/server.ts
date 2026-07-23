import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { createStellarClient, type StellarClient } from './lib/stellar.js';
import { createBridgeClient, type BridgeClient } from './lib/bridge.js';
import { ircRoutes, ircMetricsRoutes } from './routes/irc.js';
import { filesRoutes } from './routes/files.js';
import { wikiRoutes } from './routes/wiki.js';
import { aiRoutes } from './routes/ai.js';
import { mailRoutes } from './routes/mail.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    stellar: StellarClient;
    bridge: BridgeClient;
  }
}

export interface BuildServerDeps {
  // Upstream stellar-api client. Defaults to one built from `config`; injected in
  // tests as the single stub point for everything korin asks of stellar.
  stellar?: StellarClient;
  // Downstream irc-bridge delivery client (ADR-006); injected in tests so the
  // announce path is assertable without a bridge.
  bridge?: BridgeClient;
}

/**
 * Construct the Fastify app — decorate config + the stellar client, register
 * routes — and return it WITHOUT listening. The entrypoint (index.ts) calls
 * listen(); tests drive it via app.inject(). Nothing here runs at import time,
 * so importing this module never opens a socket or reads the environment.
 */
export function buildServer(config: Config, deps: BuildServerDeps = {}): FastifyInstance {
  const app = Fastify({ logger: true });

  app.decorate('config', config);
  app.decorate('stellar', deps.stellar ?? createStellarClient(config));
  app.decorate('bridge', deps.bridge ?? createBridgeClient(config));

  app.register(ircRoutes);
  app.register(ircMetricsRoutes);
  app.register(filesRoutes);
  app.register(wikiRoutes);
  app.register(aiRoutes);
  app.register(mailRoutes);

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
