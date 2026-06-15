# Multi-stage build for the Docusaurus wiki.
# Stage 1 builds the static site (baseUrl /wiki/); stage 2 serves it with nginx.
# The Caddy front-door reverse-proxies /wiki/* to this container.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# baseUrl is /wiki/, so the build is served under the /wiki path prefix.
COPY --from=build /app/build /usr/share/nginx/html/wiki
EXPOSE 80
