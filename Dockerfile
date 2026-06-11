# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=6043

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/uploads /app/secrets /backups \
  && chown -R nextjs:nodejs /app/uploads /app/secrets /backups \
  && chmod 700 /app/secrets

COPY --from=builder /app/public ./public
COPY --from=builder /app/db/migrations ./db/migrations
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/scripts/cleanup-reservations.mjs ./scripts/cleanup-reservations.mjs
COPY --from=builder /app/scripts/init.sh ./scripts/init.sh
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/scripts/startup-status.mjs ./scripts/startup-status.mjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN chmod +x /app/scripts/init.sh

USER nextjs

EXPOSE 6043

ENTRYPOINT ["/app/scripts/init.sh"]
CMD ["node", "server.js"]
