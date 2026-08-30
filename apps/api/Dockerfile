# syntax=docker/dockerfile:1
#
# IMPORTANT: the build context is the REPO ROOT, not apps/api.
# This is an npm-workspaces monorepo and the only package-lock.json lives at the
# root, so `npm ci` cannot run from inside apps/api.
#
#   docker build -f apps/api/Dockerfile -t movies-api .
#
# The CDK stack and docker-compose.yml both build it this way.

# ---- Build stage: dev dependencies + TypeScript compile ----
FROM node:20-alpine AS build
WORKDIR /repo

# Lockfile + this workspace's manifest only: npm resolves the workspace tree from
# the root lockfile and tolerates the other workspace folders being absent.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace @movies/api --include-workspace-root

COPY apps/api ./apps/api
RUN npm run build --workspace @movies/api

# ---- Production dependencies ----
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace @movies/api --include-workspace-root --omit=dev \
 && mkdir -p /repo/apps/api/node_modules

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/api

RUN addgroup -g 1001 -S nodejs && adduser -S apiuser -u 1001 -G nodejs

# npm hoists to the workspace root; the per-workspace folder is copied too in case
# a dependency cannot be hoisted.
COPY --from=deps --chown=apiuser:nodejs /repo/node_modules /repo/node_modules
COPY --from=deps --chown=apiuser:nodejs /repo/apps/api/node_modules ./node_modules
COPY --from=build --chown=apiuser:nodejs /repo/apps/api/dist ./dist
COPY --chown=apiuser:nodejs apps/api/package.json ./

USER apiuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/src/server.js"]
