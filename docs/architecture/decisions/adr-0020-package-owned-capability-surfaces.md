---
type: "Architecture Decision Record"
title: "Package-owned capability surfaces"
description: "The frontend consumes capability surface data from the versioned backend catalog package."
tags: [architecture, capabilities, composition, package]
status: stable
---
# ADR-0020: Package-owned capability surfaces

## Status

Accepted.

## Context

The backend authoring source carries each capability's UI surface: compatibility field, view flag, feature domains, routes, feature barrels, and any unique implementation symbols that profile exclusion must prove absent. The frontend previously maintained the same mapping by hand in its surface registry, which created a second source of truth and allowed backend/frontend drift.

## Decision

The backend publishes the surface block, including `artifactSymbols`, in the versioned `@alphaci/capability-catalog` package. The web app resolves that package through the npm workspace and uses its catalog records as the input to capability profile resolution, package checks, surface validation, and fail-closed implementation stubs.

`artifactSymbols` identify implementation names for exclusion scanning only. Excluded feature aliases expose a default `notFound()` stub and never re-emit those implementation names.

The web app reads the surfaces from the package; it keeps no copy of them.

## Consequences

- Surface changes are authored in the API composition source and regenerated into the package, which the web app consumes.
- A real Enterprise client-composition surface is gated by the resolved backend capability and configuration projection; the frontend does not define a second client catalog or imply capabilities the backend did not enable.
- Frontend profile exclusion and compatibility checks use the same versioned surface contract as the package drift check.
- A stale or tampered package fails the API's package check.
- The frontend no longer owns an independent surface map.

## Verification

In `apps/web`, run `node scripts/check-capabilities.cjs`, `node scripts/check-build-profiles.cjs`, and `node scripts/check-documentation.cjs`. `npm run check:capability-package -w @alphaci/api` validates the package and recomputes its canonical artifact digest.
