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

A feature action uses the shallowest layout that fits. The default is view plus view-model plus data, with model for pure rules. Views do not fetch. Model files do not import React or Next.

## Rejected alternatives

- Putting product logic in App Router pages was rejected.
- Recreating `src/components/`, `src/hooks/`, or domain-specific `src/lib/` roots was rejected.
- Copying the tree for SaaS, EDU, and Enterprise was rejected.

## Consequences

- A reader can move from a URL to a feature barrel without translating layers.
- Feature domains map to backend contexts in documentation, not by duplicating backend ownership.
- The [feature map](/architecture/feature-map.generated.md) and [architecture checks](/architecture/architecture-checks.generated.md) are part of the review surface.

## Verification

`npm run boundaries` and `npm run arch:check` verify this decision.
