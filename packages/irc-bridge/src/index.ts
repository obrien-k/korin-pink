import { Client } from 'irc-framework';
import { createBridge, type BridgeConfig } from './bridge.js';

// ---------------------------------------------------------------------------
// Thin entrypoint — read env, build the real client, start the bridge.
//
// Mirrors korin's index.ts → buildServer split: all bridge logic lives in
// createBridge() and is import-side-effect-free; this file is the only place that
// touches the environment, opens a socket, or installs signal handlers.
// ---------------------------------------------------------------------------

const config: BridgeConfig = {
  host: process.env.IRC_HOST ?? 'localhost',
  port: parseInt(process.env.IRC_PORT ?? '6697', 10),
  tls: (process.env.IRC_TLS ?? 'true') !== 'false',
  nick: process.env.IRC_NICK ?? 'stellar-bridge',
  saslUser: process.env.IRC_SASL_USER ?? '',
  saslPass: process.env.IRC_SASL_PASS ?? '',
  korinApiUrl: process.env.KORIN_API_URL ?? 'http://localhost:3000',
  bridgeSecret: process.env.IRC_BRIDGE_SECRET ?? '',
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS ?? '60000', 10),
  // The bridge only accumulates activity in channels it joins. Defaults to the core
  // set (registered at deploy via ChanServ — see packages/irc/ergo.yaml).
  channels: (process.env.IRC_CHANNELS ?? '#announce,#stellar,#korin')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean),
};

// auto_reconnect:false — createBridge owns the single reconnect path so v4's built-in
// reconnect can't race it (the reconnect-overlap watchpoint from #20).
const client = new Client({ auto_reconnect: false });
const bridge = createBridge(config, { client });

async function shutdown(signal: string): Promise<void> {
  console.log(`[bridge] ${signal} — flushing and shutting down`);
  await bridge.stop();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log(
  `[bridge] starting — ${config.host}:${config.port} tls=${config.tls} flush=${config.flushIntervalMs}ms`,
);
bridge.start();
