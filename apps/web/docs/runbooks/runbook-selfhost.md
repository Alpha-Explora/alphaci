---
type: "Playbook"
title: "Self-hosted frontend image"
description: "Build the single frontend image for a self-hosted AlphaCI install and the same-origin runtime contract it relies on."
tags: [runbook, selfhost, docker, deployment]
status: stable
sources:
  - id: dockerfile
    resource: "Dockerfile"
    title: "Frontend image definition"
  - id: api-client
    resource: "src/shared/api/request.ts"
    title: "API base URL resolution"
  - id: healthz
    resource: "src/app/healthz/route.ts"
    title: "Liveness route"
---
# Self-hosted frontend image

One frontend image serves every self-hosted customer. Alpha Explora builds it once with the fixed arguments below. Customers do not rebuild it and do not pass build arguments. The backend repository owns the install: `deploy/selfhost/` (Docker Compose, Caddy, `alphaci-ctl`) and its `docs/runbooks/runbook-selfhost-install.md`.

## Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api/v1 \
  --build-arg ALPHACI_BUILD_PROFILE=enterprise \
  --build-arg ALPHACI_EDITION=enterprise \
  -t ghcr.io/alpha-explora/alphaci-fe:<version> .
```

| Argument | Value | Reason |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` | Relative, same-origin base. The browser calls the reverse proxy on the page's own host, so the image names no hostname. |
| `ALPHACI_BUILD_PROFILE` | `enterprise` | Capability ceiling for the Enterprise artifact. |
| `ALPHACI_EDITION` | `enterprise` | The root path redirects to `/login`. The marketing landing is SaaS only. |

The builder stage pins `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_DEV_QUICK_LOGIN=false`, so a developer's local `.env` cannot switch on mock data or the quick-login control. Do not add `API_PROXY_TARGET`: the image does not accept it, and the reverse proxy owns `/api`.

The install pins the published image by digest: `ALPHACI_WEB_IMAGE=ghcr.io/alpha-explora/alphaci-fe@sha256:<digest>` in the backend's `deploy/selfhost/.env`.

## Image layout

- Stages: `base` (`node:24-alpine`, `apk upgrade`), `deps` (`npm ci`), `builder` (`npm run build`), `runner`.
- `runner` installs production dependencies only, removes npm and npx, and copies `.next`, `public`, and the files `next start` needs to load `next.config.ts` again (the config, two `src/` modules, `scripts/lib`, `vendor`, and the catalog provenance record).
- It runs `next start -p 3000` and exposes port 3000.

## Runtime contract

The customer's server serves one HTTPS origin. Caddy routes by path (backend `deploy/selfhost/caddy/Caddyfile`):

```
{$ALPHACI_HOSTNAME} {
	tls {$ALPHACI_TLS_DIRECTIVE}
	handle /api/* {
		reverse_proxy api:4000 {
			header_up X-Forwarded-Proto https
		}
	}
	handle {
		reverse_proxy web:3000
	}
}
```

- `/api/*` goes to the backend container `api` on port 4000. The path passes through unchanged, so the backend's `/api/v1` prefix still applies.
- Every other path goes to the frontend container `web` on port 3000.
- Plain HTTP on port 80 only redirects to HTTPS.
- The frontend reads no application settings at runtime. Its composition and API base are fixed in the image. Compose sets only `PORT`, `HOSTNAME`, and `NODE_ENV` for `web`.

### Liveness

- `GET /healthz` on the frontend returns `200 {"status":"ok"}`. It does not call the backend, so a backend outage does not mark the frontend unhealthy.
- The image's `HEALTHCHECK` calls that route every 30 seconds with Node's built-in `fetch`, because the image has no curl. Compose defines its own `web` health check against the same route, and `proxy` starts only after `web` is healthy.

### Backend settings that must match the public origin

These live in the backend `alphaci.env`, written by `alphaci-ctl init`. This repository does not set them.

- `FRONTEND_URL` is `https://<host>`.
- `ALLOWED_ORIGINS` includes `https://<host>`. The sign-in `returnTo` allow-list is built from `FRONTEND_URL` and `ALLOWED_ORIGINS`.
- `GITHUB_CALLBACK_URL` is `https://<host>/api/v1/auth/github/callback`, and the GitHub OAuth app uses the same URL.
- `SESSION_COOKIE_SAMESITE=lax`, because the frontend and the API share one origin.
- `ALPHACI_BUILD_PROFILE=enterprise` and `ALPHACI_EDITION=enterprise`, matching this image. Nothing cross-checks the two services, so keep them aligned by hand.

Sign-in works like this. The browser opens `/api/v1/auth/github/start?returnTo=https://<host>/auth/callback?...`. The backend redirects to GitHub. After GitHub calls back, the backend returns the browser to `returnTo` only when that origin is on the allow-list.

### Network

- The browser needs only the single origin.
- The `web` container needs outbound HTTPS only to the avatar hosts that `next/image` loads: `avatars.githubusercontent.com`, `lh3.googleusercontent.com`, and `*.googleusercontent.com`.
- The install is not egress-only. GitHub-hosted runners call `/api/v1/ci/*` through the same proxy, so inbound 443 is required. The backend install runbook lists the firewall rules.

## Verify after deploy

```bash
curl -fsS https://<host>/healthz
curl -fsS -o /dev/null -w '%{http_code}\n' https://<host>/login
docker compose ps web
```

Expect `{"status":"ok"}`, then `200`, then `web` reported as `healthy`.

## Known limits

- The bundle still contains the development fallback string `http://localhost:4000`. That branch runs only when the API base is unset, and the self-hosted build always sets it.
- There is no `selfhosted` build profile. The image uses the `enterprise` profile. A dedicated profile would need matching changes in the backend's build-profile and capability catalog, which are outside this repository.
- This repository has no workflow that builds or publishes the image. The release build runs outside it.
