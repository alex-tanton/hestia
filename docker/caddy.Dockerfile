# syntax=docker/dockerfile:1
# caddy: the static PWA build plus the Caddyfile. Built from the repository root (see
# docker-compose.yml); tagged with the commit SHA by scripts/deploy.sh, so the PWA, routing, and
# headers roll back together.

FROM node:24.22.1-bookworm-slim AS build
ENV CI=true HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=hestia-pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile --store-dir /pnpm/store

COPY . .
# Client configuration variables prefixed with HESTIA_PUBLIC_ are recognized directly by Vite.
ARG HESTIA_PUBLIC_MAGIC_LINK_ENABLED=true
ENV HESTIA_PUBLIC_MAGIC_LINK_ENABLED=$HESTIA_PUBLIC_MAGIC_LINK_ENABLED

ARG HESTIA_PUBLIC_SUPABASE_ANON_KEY
ENV HESTIA_PUBLIC_SUPABASE_ANON_KEY=$HESTIA_PUBLIC_SUPABASE_ANON_KEY

ARG HESTIA_PUBLIC_VAPID_KEY
ENV HESTIA_PUBLIC_VAPID_KEY=$HESTIA_PUBLIC_VAPID_KEY
RUN --mount=type=cache,id=hestia-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --filter @hestia/web... \
 && pnpm --filter @hestia/web build

FROM caddy:2.11.7-alpine
ARG HESTIA_REVISION=dev
LABEL org.opencontainers.image.revision=$HESTIA_REVISION
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/caddy-entrypoint.sh /usr/local/bin/caddy-entrypoint.sh
COPY --from=build /repo/apps/web/dist /srv
EXPOSE 8080
CMD ["/bin/sh", "/usr/local/bin/caddy-entrypoint.sh"]
