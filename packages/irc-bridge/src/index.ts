console.log('irc-bridge starting...');

function handleSigterm() {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
}

process.on('SIGTERM', handleSigterm);
process.on('SIGINT', handleSigterm);

// TODO(#2): Connect to Ergo and track events, flush to korin API metrics endpoint.
