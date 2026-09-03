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
│   └── (public)/                         # in-product guide
├── features/                             # UI ownership by domain
│   ├── admin/
│   ├── auth/
│   ├── capabilities/
│   ├── groups/
│   ├── guide/
│   ├── home/
│   ├── notifications/
│   ├── projects/
│   ├── runs/
│   ├── settings/
│   ├── teams/
│   ├── workflows/
│   └── workspace/
├── shared/                               # domain-free primitives
│   ├── api/                              # transport and wire contracts
│   ├── layout/
│   ├── lib/
│   ├── styles/
│   └── ui/
└── styles/                               # cascaded product stylesheets
```

Each feature domain has an `index.ts` public API. Actions inside a domain follow view / view-model / data / model layers. The full ownership inventory is in the [generated feature map](/architecture/feature-map.generated.md).

## Routing

`src/app/` is a routing table. Most pages re-export one feature view. `/`, `/login`, `/signup`, and `/auth/callback` keep small inline composition because they are entry and session seams. `/` redirects to `/login`. `/signup` redirects to `/login`. The [route map](/architecture/route-map.generated.md) is generated from `page.tsx` files.

## Shared layer

`src/shared/` holds primitives that at least two features need: transport, layout shell pieces, design tokens, and pure helpers. `src/shared/api/` owns `request` and `ApiError`. Wire DTO types currently live in `src/shared/api/contracts.ts` because the backend is one deployable with one wire vocabulary. Feature `model/` files re-export the subset a slice uses.

`credentials: "include"` is required on API calls so the backend session cookie `cicd_workflow_sid` is sent. The frontend origin must be listed in the backend `CORS_ORIGINS`. The canonical API origin variable is `NEXT_PUBLIC_API_BASE_URL`.

## Capability consumption

The capabilities feature loads `GET /api/v1/capabilities` and maps the compatibility response into view flags. Screens hide optional panels from those flags. This frontend does not select SaaS, EDU, or Enterprise at runtime. Pack selection remains a documentation and backend composition concern.

The Teams and group routes are present for authenticated users. The `hierarchyEnabled` flag is loaded but does not currently hide those routes. `auditEventsEnabled` and `usageQuotasEnabled` are loaded and have no dedicated panel yet. Those facts are recorded in the [capability matrix](/capabilities/capability-matrix.generated.md).

There is no `/subscribe` route and no payment checkout UI. Authenticated users are sent to the path they asked for.

## Verification

The local architecture loop is documented in the [verification runbook](/runbooks/runbook-local-verification.md). The [architecture check map](/architecture/architecture-checks.generated.md) records measured source metrics and points to the executable gates.
