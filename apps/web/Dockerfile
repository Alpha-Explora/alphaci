FROM node:24-alpine AS base
WORKDIR /app

# Keep OS packages patched; avoid global npm upgrades that can introduce extra CVEs.
RUN apk upgrade --no-cache

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
# Build-time composition values are inlined into the client bundle. Left unset,
# the build keeps its existing hosted path. A self-hosted image passes the fixed
# set documented in docs/runbooks/runbook-selfhost.md, never a per-customer value.
ARG NEXT_PUBLIC_API_BASE_URL
ARG ALPHACI_BUILD_PROFILE
ARG ALPHACI_EDITION
# Dev-only switches must never reach a production image, even when a developer's
# local .env (which Next.js reads during the build) sets them.
ENV NEXT_PUBLIC_USE_MOCK=false \
	NEXT_PUBLIC_DEV_QUICK_LOGIN=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev \
	&& npm cache clean --force \
	&& rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# `next start` loads next.config.ts again, and that file imports these modules and
# reads the vendored capability catalog. Copy that closure and nothing else.
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src/shared/api/api-proxy-rewrites.ts ./src/shared/api/api-proxy-rewrites.ts
COPY --from=builder /app/src/shared/composition/build-profile.ts ./src/shared/composition/build-profile.ts
COPY --from=builder /app/scripts/lib ./scripts/lib
COPY --from=builder /app/vendor ./vendor
COPY --from=builder /app/docs/capabilities/catalog.provenance.json ./docs/capabilities/catalog.provenance.json
EXPOSE 3000
# The image has no curl, so the probe uses Node's built-in fetch. It calls the
# cheap /healthz route, which does not touch the backend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(4000)}).then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
