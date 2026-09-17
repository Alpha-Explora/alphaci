---
type: "Architecture Decision Record"
title: "Package-owned capability surfaces"
description: "The frontend consumes capability surface data from the versioned backend catalog package."
tags: [architecture, capabilities, composition, package]
status: stable
---
# ADR-0005: Package-owned capability surfaces

## Status

Accepted.

## Context

The backend authoring source carries each capability's UI surface: compatibility field, view flag, feature domains, routes, feature barrels, and any unique implementation symbols that profile exclusion must prove absent. The frontend previously maintained the same mapping in `docs/capabilities/surface-registry.ts`, which created a second source of truth and allowed backend/frontend drift.

## Decision

The backend publishes the surface block, including `artifactSymbols`, in the versioned `@alphaci/capability-catalog` package. The frontend vendors that package and uses its catalog records as the input to capability profile resolution, package checks, surface validation, and fail-closed implementation stubs.

`artifactSymbols` identify implementation names for exclusion scanning only. Excluded feature aliases expose a default `notFound()` stub and never re-emit those implementation names.

`docs/capabilities/catalog.snapshot.json` includes the published surface fields so documentation drift is visible. `docs/capabilities/surface-registry.ts` remains because the OKF bundle references it, but it is generated from the vendored package and must not be edited by hand.

## Consequences

- Surface changes are authored in the backend composition source, released with the package, and re-vendored by the frontend.
- A real Enterprise client-composition surface is gated by the resolved backend capability and configuration projection; the frontend does not define a second client catalog or imply capabilities the backend did not enable.
- Frontend profile exclusion and compatibility checks use the same versioned surface contract as the package drift check.
- A stale or tampered package, snapshot, provenance record, or generated documentation registry fails the frontend checks.
- The frontend no longer owns an independent surface map.

## Verification

Run `node scripts/check-capability-package.cjs`, `node scripts/check-capabilities.cjs`, `node scripts/check-build-profiles.cjs`, and `node scripts/check-documentation.cjs`. The package check validates the vendored provenance and recomputes its canonical artifact digest.
