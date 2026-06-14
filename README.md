# korin.pink 🌸

Public infrastructure layer and CRS bridge for Stellar's IRC operations.

## Architecture
- **`packages/api`**: Fastify API managing Google Drive, Gemini AI, Gmail, and the `/irc/metrics` boundary.
- **`packages/irc-bridge`**: Node.js daemon that connects to the private Ergo server, tracks user presence, and flushes metrics to the API.
- **`packages/web`**: Static, aesthetically-rich landing portal.

*Note: The actual Ergo IRC daemon and its configuration are maintained privately in `korin-omnibus` to protect proprietary connection limits and rules.*
