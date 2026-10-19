---
type: "Decision"
title: "Feature-sliced MVVM"
description: "Keep the frontend as one Next.js deployable organized around feature domains with thin App Router pages."
tags: [architecture, decision, features]
status: stable
timestamp: "2026-09-03T00:00:00Z"
sources:
  - id: feature-tree
    resource: "src/features"
    title: "Current feature composition"
  - id: layer-gate
    resource: "scripts/check-boundaries.mjs"
    title: "Feature MVVM layer checker"
---
# ADR-0001: Feature-sliced MVVM

**Decision date:** 2026-09-03
**Decision status:** Accepted
**Scope:** AlphaCI frontend application composition

## Decision

The frontend is organized as feature domains in one Next.js deployable:

1. `src/app/` is a routing table.
2. `src/features/<domain>/` owns UI, orchestration, and domain HTTP.
3. `src/shared/` owns domain-free primitives.

A feature action uses the shallowest layout that fits. The default is view plus view-model plus data, with model for pure rules. Views do not fetch. Model files do not import React or Next. A view-model exposes one `status` and a render-safe `error`.

`src/app/` uses the route groups `(access)`, `(public)`, and `(platform)` to sort pages by navigation context. Groups never change a URL, and there is no domain-named group: `features/` already expresses ownership. There is no shared `(platform)/layout.tsx`; each page composes its own shell.

Feature domains are ownership boundaries with their own types and rules (DDD-lite). `data/` modules are the anti-corruption layer for transport. Aggregates, command buses, domain events, and entity classes are not used.

Data loading uses plain view-model effects over `data/` repositories. No query cache, state-management library, or server action is used.

When code moves between slices, every consumer moves in the same change; no deep-import compatibility shim remains.

## Rejected alternatives

- Putting product logic in App Router pages was rejected.
- Recreating `src/components/`, `src/hooks/`, or domain-specific `src/lib/` roots was rejected.
- Copying the tree for SaaS, EDU, and Enterprise was rejected.
- Domain-named route groups such as `(projects)` were rejected because they duplicate the feature tree.

## Consequences

- A reader can move from a URL to a feature barrel without translating layers.
- Feature domains map to backend contexts in documentation, not by duplicating backend ownership.
- The [feature map](/architecture/feature-map.generated.md) and [architecture checks](/architecture/architecture-checks.generated.md) are part of the review surface.

## Verification

`npm run boundaries` and `npm run arch:check` verify this decision.
