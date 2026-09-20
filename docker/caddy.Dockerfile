# syntax=docker/dockerfile:1
# caddy: the static PWA build plus the Caddyfile. Built from the repository root (see
# docker-compose.yml); tagged with the commit SHA by scripts/deploy.sh, so the PWA, routing, and
# headers roll back together.

FROM node:24.21.0-bookworm-slim AS build
ENV CI=true HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=hearth-pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile --store-dir /pnpm/store

COPY . .
# The PWA build omits the magic-link screens unless this is true (Technical Architecture,
# "Auth configuration"). Vite exposes only VITE_-prefixed variables to the app, as
# import.meta.env.VITE_MAGIC_LINK_ENABLED.
ARG HEARTH_MAGIC_LINK_ENABLED=false
ENV VITE_MAGIC_LINK_ENABLED=$HEARTH_MAGIC_LINK_ENABLED
# Kong requires an apikey on every /auth/v1 call, so supabase-js in the PWA is built with the
# anon key. It is the public half of the pair and carries no privilege of its own; RLS and the
# service decide what a caller may do.
ARG ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=$ANON_KEY
RUN --mount=type=cache,id=hearth-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --filter @hearth/web... \
 && pnpm --filter @hearth/web build

FROM caddy:2.11.4-alpine
ARG HEARTH_REVISION=dev
LABEL org.opencontainers.image.revision=$HEARTH_REVISION
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/caddy-entrypoint.sh /usr/local/bin/caddy-entrypoint.sh
COPY --from=build /repo/apps/web/dist /srv
EXPOSE 8080
CMD ["/bin/sh", "/usr/local/bin/caddy-entrypoint.sh"]
