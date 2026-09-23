---
type: "Playbook"
title: "Frontend session authentication"
description: "Current procedure for cookie session, CORS, and API origin checks."
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

- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` and must match the running backend origin. `NEXT_PUBLIC_API_URL` remains a legacy alias.
- Fetch calls use `credentials: "include"` so `cicd_workflow_sid` is sent cross-origin.
- A cross-site backend cookie is third-party, and Safari, Brave, Firefox strict and incognito drop it: sign-in shows "did not complete" although the backend saved the session. Until the frontend and backend share a parent domain, set `API_PROXY_TARGET` to the backend origin and `NEXT_PUBLIC_API_BASE_URL` to `/api/v1`, so this host proxies the API and the cookie is first-party. The backend runbook `runbook-auth-custom-domain-cutover.md` lists the matching backend and GitHub OAuth App settings.
- The frontend origin must appear in the backend `CORS_ORIGINS`.
- Sign-out uses `useAuthSession().signOut` / `isSigningOut`. Do not call `logout()` and `refresh()` by hand on a new surface.
- There is no `/subscribe` route. `getAuthenticatedRedirectPath` sends authenticated users to the path they asked for. Guests go to `/login`.

## Check

1. Start the backend on the origin configured as `NEXT_PUBLIC_API_URL`.
2. Start the frontend on the origin listed in backend `CORS_ORIGINS` and `FRONTEND_URL`.
3. Sign in with GitHub.
4. Confirm `/auth/me` succeeds with credentials included and the UI reaches `/home`.
5. Confirm a browser storage inspection shows no GitHub or provider access tokens.

## Evidence

Record the frontend origin, backend origin, pass/fail result, and whether a real GitHub OAuth app was used. A unit-test pass does not prove cross-origin cookie behavior.
