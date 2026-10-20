---
type: "Playbook"
title: "Frontend session authentication"
description: "Current procedure for cookie session, allowed origins, and API base checks."
tags: [runbook, authentication, session]
status: stable
sources:
  - id: request
    resource: "src/shared/api/request.ts"
    title: "Frontend API transport"
  - id: api-proxy
    resource: "src/shared/api/api-proxy-rewrites.ts"
    title: "Same-origin API bridge"
  - id: auth-rules
    resource: "src/features/auth/session/model/auth-rules.ts"
    title: "Authenticated redirect rules"
---
# Frontend session authentication

The backend owns the session. The frontend sends the session cookie on every API call and never stores provider tokens in the browser.

## Current rules

- The API base comes from `NEXT_PUBLIC_API_BASE_URL`, inlined at build time. `/api/v1` is appended when missing. `NEXT_PUBLIC_API_URL` remains a legacy alias.
- Every call uses `credentials: "include"`, so the `cicd_workflow_sid` cookie is sent.
- Sign-in opens `<api>/auth/github/start?returnTo=<frontend>/auth/callback?...`. The backend returns the browser to `returnTo` only when its origin is `FRONTEND_URL`, is listed in `ALLOWED_ORIGINS`, or matches `ALLOWED_ORIGIN_PATTERNS`.
- On a separate backend origin, the frontend origin must be in the backend `ALLOWED_ORIGINS` (the CORS allow-list).
- Same origin is the default for the self-hosted image: `NEXT_PUBLIC_API_BASE_URL=/api/v1` and the reverse proxy routes `/api/*` to the backend. See [Self-hosted frontend image](/runbooks/runbook-selfhost.md).
- A cross-site backend cookie is third-party, and Safari, Brave, Firefox strict and incognito drop it: sign-in shows "did not complete" although the backend saved the session. For a hosted deployment on separate domains, set `API_PROXY_TARGET` to the backend origin and `NEXT_PUBLIC_API_BASE_URL` to `/api/v1` at build time. This Next.js server then proxies `/api/v1/*` and the cookie is first-party. The backend runbook `runbook-auth-custom-domain-cutover.md` lists the matching backend and GitHub OAuth App settings.
- Sign-out uses `useAuthSession().signOut` / `isSigningOut`. Do not call `logout()` and `refresh()` by hand on a new surface.
- There is no `/subscribe` route. `getAuthenticatedRedirectPath` sends authenticated users to the path they asked for. Guests go to `/login`.

## Check

1. Start the backend and build or run the frontend with `NEXT_PUBLIC_API_BASE_URL` pointing at it.
2. Confirm the frontend origin equals the backend `FRONTEND_URL` and is in `ALLOWED_ORIGINS`.
3. Sign in with GitHub.
4. Confirm `/auth/me` succeeds with credentials included and the UI reaches `/home`.
5. Confirm a browser storage inspection shows no GitHub or provider access tokens.

## Evidence

Record the frontend origin, backend origin, pass/fail result, and whether a real GitHub OAuth app was used. A unit-test pass does not prove cross-origin cookie behavior.
