FROM node:20-alpine AS base
WORKDIR /app

# copy package metadata
COPY package.json ./

# install deps
RUN npm install --no-package-lock

# copy source
COPY src ./src

# expose the default bridge port (if any) – not strictly needed for dev
EXPOSE 8080

# run the bridge in dev mode (tsx watch) – suitable for local development
CMD ["npm", "run", "dev"]
