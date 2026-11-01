---
type: "Architecture Reference"
title: "Current AlphaCI frontend architecture"
description: "Current source, routing, feature, capability, and verification composition for the AlphaCI frontend."
tags: [architecture, current-state, feature-mvvm]
status: stable
sources:
  - id: app-router
    resource: "src/app"
    title: "App Router pages"
  - id: feature-tree
    resource: "src/features"
    title: "Feature domain tree"
  - id: shared
    resource: "src/shared"
    title: "Domain-free shared layer"
---
# Current AlphaCI frontend architecture

The frontend is one Next.js App Router deployable with React 19, Tailwind 4, a shared technical layer, and feature domains that consume the backend HTTP API. The [constitution](/constitution.md) defines the invariants that keep this composition coherent.

## Runtime tree

```text
src/
├── app/                                  # routing table
│   ├── (access)/                         # login, signup, auth callback
│   ├── (platform)/                       # authenticated product routes
│   ├── (public)/                         # in-product guide
│   ├── healthz/                          # liveness route handler
│   └── page.tsx                          # / : SaaS landing or redirect to /login
├── features/                             # UI ownership by domain
│   ├── admin/
│   ├── auth/
│   ├── capabilities/
│   ├── checklists/
│   ├── groups/
│   ├── guide/
│   ├── home/
│   ├── hosts/
│   ├── notifications/
│   ├── projects/
│   ├── public-site/
│   ├── runs/
│   ├── settings/
│   ├── teams/
│   ├── workflows/
│   └── workspace/
├── shared/                               # domain-free primitives
│   ├── api/                              # transport, wire contracts, API proxy rewrite
│   ├── browser/
│   ├── composition/                      # build profile and edition
│   ├── layout/
│   ├── styles/                           # tokens, reset, typography
│   └── ui/
└── styles/                               # cascaded product stylesheets
```

Each feature domain has an `index.ts` public API. Actions inside a domain follow view / view-model / data / model layers. The full ownership inventory is in the [generated feature map](/architecture/feature-map.generated.md).

## Routing

`src/app/` is a routing table. Most pages re-export one feature view. `/`, `/login`, `/signup`, and `/auth/callback` keep small inline composition because they are entry and session seams. `/` serves the public-site landing in the SaaS edition and redirects to `/login` otherwise. `/signup` redirects to `/login`. `/healthz` answers `{"status":"ok"}` without calling the backend. The [route map](/architecture/route-map.generated.md) is generated from `page.tsx` files.

## Shared layer

`src/shared/` holds primitives that at least two features need: transport, layout shell pieces, design tokens, build composition, and UI primitives. `src/shared/api/` owns `request`, `ApiError`, and `getApiBaseUrl`. Wire DTO types live in `src/shared/api/contracts.ts` because the backend is one deployable with one wire vocabulary. Feature `model/` files re-export the subset a slice uses.

## API and session

The API base is `NEXT_PUBLIC_API_BASE_URL`, inlined at build time; `/api/v1` is appended when missing. The self-hosted image uses the relative `/api/v1`, and the reverse proxy serves the backend on the same origin. `credentials: "include"` is set on every call so the backend session cookie `cicd_workflow_sid` is sent. On a separate backend origin, the frontend origin must be in the backend `ALLOWED_ORIGINS`. Live notifications use an `EventSource` on `/notifications/stream` with periodic reads as fallback.

## Capability consumption

The capabilities feature loads `GET /api/v1/capabilities` and maps the compatibility response into view flags. Screens hide optional panels from those flags. Feature code does not branch on edition. The only edition decision is at build time: `ALPHACI_BUILD_PROFILE` selects which feature barrels compile, and `ALPHACI_EDITION=saas` enables the landing page at `/`.

The Teams and group routes are present for authenticated users. The `hierarchyEnabled` flag is loaded but does not hide those routes. `auditEventsEnabled` and `usageQuotasEnabled` are loaded and gate no panel. Those facts are recorded in the [capability matrix](/capabilities/capability-matrix.generated.md).

There is no `/subscribe` route and no payment checkout UI. Authenticated users are sent to the path they asked for.

## Verification

The local architecture loop is documented in the [verification runbook](/runbooks/runbook-local-verification.md). The [architecture check map](/architecture/architecture-checks.generated.md) records measured source metrics and points to the executable gates.
