---
type: "Executable Contract"
title: "AlphaCI frontend constitution"
description: "Current executable invariants for feature ownership, capability consumption, packs, and documentation."
tags: [architecture, constitution, contracts]
status: stable
sources:
  - id: feature-tree
    resource: "src/features"
    title: "Feature domain tree"
  - id: boundary-gates
    resource: "scripts/check-boundaries.mjs"
    title: "Feature MVVM layer gate"
  - id: dependency-graph
    resource: ".dependency-cruiser.cjs"
    title: "Dependency graph gate"
  - id: capability-gate
    resource: "scripts/check-capabilities.cjs"
    title: "Capability surface gate"
---
# AlphaCI frontend constitution

This document is the current contract for the frontend. A code or documentation change that violates an invariant must update the relevant source and its verification evidence in the same change.

## Feature ownership

The application is one Next.js App Router deployable. Routes under `src/app/` compose feature barrels. Business behavior lives in `src/features/<domain>/`.

- A feature domain is a UI ownership boundary. It is not a backend bounded context and not a pack.
- Cross-feature imports go through a domain or action `index.ts`.
- `src/shared/` sits below every feature and must not import a feature.
- Views must not fetch. Model files must not import React, Next, or perform I/O.
- Provider tokens, GitHub access tokens, and hosting credentials do not live in the browser. The frontend talks only to the backend API base, which is same-origin `/api/v1` in the self-hosted image.

The [feature map](/architecture/feature-map.generated.md) and [route map](/architecture/route-map.generated.md) are generated from the source tree.

## Product axes

Edition, tenancy, deployment target, and feature flag are independent values. Feature code does not branch on edition; the build profile and edition are fixed at build time (`src/shared/composition/build-profile.ts`). Runtime enablement consumes the backend compatibility response at `/api/v1/capabilities`.

The narrowing order is:

```text
build -> edition manifest -> deployment configuration -> tenant override
```

A lower layer may hide a surface that an upper layer provided. No frontend flag or tenant override may present a capability the backend catalog does not provide.

The [capability contract](/capabilities/capability-contract.md) and [pack contract](/packs/pack-contract.md) define the documentation-level representation. Runtime enablement remains the backend `/api/v1/capabilities` response.

## Shared catalog

Capability keys, maturity, pack applicability, dependency edges, capability surfaces, and package provenance are owned by the backend package `@alphaci/capability-catalog`. This repository keeps a local fixture at `vendor/@alphaci/capability-catalog`, an expected provenance record at `docs/capabilities/catalog.provenance.json`, a documentation snapshot at `docs/capabilities/catalog.snapshot.json`, and a generated surface view at `docs/capabilities/surface-registry.ts`. The expected record and documentation files are verification inputs, not authoritative catalog sources.

## Documentation contract

Canonical documentation is repository-portable and current-state only. It must not depend on external session context, a branch, a checkout path, or a dated execution note. New documents use lower-kebab-case names unless a conventional entrypoint requires otherwise. Every change that alters a documented contract updates the affected concept, generated map, `docs/log.md`, and root `CHANGELOG.md`.

The [architecture checks](/architecture/architecture-checks.generated.md) and [local verification runbook](/runbooks/runbook-local-verification.md) are the executable navigation points for this rule.
