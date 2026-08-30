# syntax=docker/dockerfile:1
#
# IMPORTANT: the build context is the REPO ROOT, not apps/web.
# This is an npm-workspaces monorepo and the only package-lock.json lives at the
# root, so `npm ci` cannot run from inside apps/web.
#
#   docker build -f apps/web/Dockerfile -t movies-web .

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace @movies/web --include-workspace-root

COPY apps/web ./apps/web

# Empty = same-origin: the ALB serves the API and the SPA on one hostname, so the
# bundle ships relative /api/... URLs. Override only for a split-domain setup.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace @movies/web

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
