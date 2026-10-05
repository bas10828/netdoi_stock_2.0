# netdoi_stock 2.0 production image (see DEPLOY.md)

# ---- build: full install, `next build` (prebuild copies the zxing wasm into public/)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- run: only the standalone server, static files, and the migration script
FROM node:22-alpine AS run
WORKDIR /app
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Bangkok

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# `docker compose exec app node scripts/migrate.mjs` applies db/schema.sql
COPY --from=build --chown=node:node /app/db/schema.sql ./db/schema.sql
COPY --from=build --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs

USER node
EXPOSE 3000
CMD ["node", "server.js"]
