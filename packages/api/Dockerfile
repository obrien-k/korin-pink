FROM node:20-alpine AS base
WORKDIR /app

# copy package metadata
COPY package.json ./

# install deps
RUN npm install --no-package-lock

# copy source
COPY src ./src

# expose the port used by the API (default 3000)
EXPOSE 3000

# run the API in dev mode (tsx watch) – suitable for local development
CMD ["npm", "run", "dev"]
