# AlphaCI web (apps/web) — Production Dockerfile
#
# Build context: the monorepo root, not this directory:
#   docker build -f apps/web/Dockerfile .
# `turbo prune` narrows that context to this app, the workspace packages it
# depends on (@alphaci/capability-catalog), and a lockfile cut down to their
# dependencies.

# Keep in step with the `turbo` devDependency in the root package.json.
ARG TURBO_VERSION=2.11.10

FROM node:26-alpine AS base
WORKDIR /app

# Keep OS packages patched; avoid global npm upgrades that can introduce extra CVEs.
RUN apk upgrade --no-cache

FROM base AS pruner
ARG TURBO_VERSION
WORKDIR /repo
RUN npm install -g "turbo@${TURBO_VERSION}"
COPY . .
RUN turbo prune @alphaci/web --docker

FROM base AS deps
WORKDIR /app
COPY --from=pruner /repo/out/json/ ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
# Build-time composition values are inlined into the client bundle. Left unset,
# the build keeps its existing hosted path. A self-hosted image passes the fixed
# set documented in docs/runbooks/runbook-selfhost-web-image.md at the repository root, never a per-customer value.
ARG NEXT_PUBLIC_API_BASE_URL
ARG ALPHACI_BUILD_PROFILE
ARG ALPHACI_EDITION
# Dev-only switches must never reach a production image, even when a developer's
# local .env (which Next.js reads during the build) sets them.
ENV NEXT_PUBLIC_USE_MOCK=false \
	NEXT_PUBLIC_DEV_QUICK_LOGIN=false
COPY --from=pruner /repo/out/full/ ./
WORKDIR /app/apps/web
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ ./
RUN npm ci --omit=dev \
	&& npm cache clean --force \
	&& rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
# The shared capability catalog is a workspace package: npm ci links
# node_modules/@alphaci/capability-catalog to this folder.
COPY --from=pruner /repo/out/full/packages/capability-catalog ./packages/capability-catalog
WORKDIR /app/apps/web
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
# `next start` loads next.config.ts again, and that file imports these modules and
# reads the capability catalog package. Copy that closure and nothing else.
COPY --from=builder /app/apps/web/next.config.ts ./next.config.ts
COPY --from=builder /app/apps/web/src/shared/api/api-proxy-rewrites.ts ./src/shared/api/api-proxy-rewrites.ts
COPY --from=builder /app/apps/web/src/shared/composition/build-profile.ts ./src/shared/composition/build-profile.ts
COPY --from=builder /app/apps/web/scripts/lib ./scripts/lib
EXPOSE 3000
# The image has no curl, so the probe uses Node's built-in fetch. It calls the
# cheap /healthz route, which does not touch the backend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(4000)}).then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# Dependencies are hoisted to the workspace root, so `next` lives in /app/node_modules.
CMD ["node", "/app/node_modules/next/dist/bin/next", "start", "-p", "3000"]
