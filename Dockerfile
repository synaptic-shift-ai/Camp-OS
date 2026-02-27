# syntax=docker/dockerfile:1

# ─── Base: shared Node version ────────────────────────────────────────────────
FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ─── deps: install production + dev dependencies ──────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ─── builder: compile the Next.js production bundle ──────────────────────────
FROM deps AS builder
COPY . .
RUN npm run build

# ─── production: lean runtime image ──────────────────────────────────────────
FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Only copy what next start needs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

# ─── development: full source with hot-reload ─────────────────────────────────
FROM deps AS development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
