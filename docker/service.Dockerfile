# syntax=docker/dockerfile:1
# hearth-service: the Fastify API, job runner, and hearth-admin CLI. Built from the repository
# root (see docker-compose.yml); tagged with the commit SHA by scripts/deploy.sh.

FROM node:26.11.1-bookworm-slim AS source
ENV CI=true HUSKY=0
RUN corepack enable
WORKDIR /repo
# Dependencies are fetched from the lockfile alone, so a source-only change reuses this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=hearth-pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile --store-dir /pnpm/store
COPY . .

FROM source AS build
RUN --mount=type=cache,id=hearth-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --filter @hearth/service... \
 && pnpm --filter @hearth/service build

# Workspace packages are bundled into dist by tsup, so the runtime needs only the service's
# own production dependencies.
FROM source AS prod-deps
RUN --mount=type=cache,id=hearth-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --prod --ignore-scripts --store-dir /pnpm/store --filter @hearth/service

FROM node:26.11.1-bookworm-slim
ARG HEARTH_REVISION=dev
LABEL org.opencontainers.image.revision=$HEARTH_REVISION
ENV NODE_ENV=production
# pnpm's node_modules links are relative, so the repository layout is kept.
COPY --from=prod-deps /repo/node_modules /app/node_modules
COPY --from=prod-deps /repo/apps/service/node_modules /app/apps/service/node_modules
COPY --from=build /repo/apps/service/package.json /app/apps/service/package.json
COPY --from=build /repo/apps/service/dist /app/apps/service/dist
# The owner CLI on the PATH, so `docker compose exec hearth-service hearth-admin ...` works.
COPY --from=build --chmod=755 /repo/apps/service/bin/hearth-admin /app/apps/service/bin/hearth-admin
RUN ln -s /app/apps/service/bin/hearth-admin /usr/local/bin/hearth-admin
WORKDIR /app/apps/service
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
