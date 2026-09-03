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
  - id: auth-rules
    resource: "src/features/auth/session/model/auth-rules.ts"
    title: "Authenticated redirect rules"
---
# Frontend session authentication

The backend owns the session. The frontend sends the session cookie on every API call and never stores provider tokens in the browser.

## Current rules

- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` and must match the running backend origin. `NEXT_PUBLIC_API_URL` remains a legacy alias.
- Fetch calls use `credentials: "include"` so `cicd_workflow_sid` is sent cross-origin.
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
