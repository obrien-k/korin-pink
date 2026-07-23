FROM node:20-alpine AS base
WORKDIR /app

# copy package metadata
COPY package.json ./

# install deps
RUN npm install --no-package-lock

# copy source
COPY src ./src

# The announce delivery endpoint (ADR-006), IRC_BRIDGE_PORT. Compose-internal:
# never published, reached by the api over the korin network. Documentation only —
# EXPOSE gates nothing — but `docker compose ps` prints it, so a stale number is
# actively misleading in exactly the place you look when delivery breaks.
EXPOSE 8081

# run the bridge in dev mode (tsx watch) – suitable for local development
CMD ["npm", "run", "dev"]
