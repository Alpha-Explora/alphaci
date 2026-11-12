---
type: "Architecture Checks"
title: "Architecture check map"
description: "Generated snapshot of frontend source metrics and the repository architecture gates."
tags: [architecture, checks, map, verification]
status: stable
sources:
  - id: "features"
    resource: "apps/web/src/features"
    title: "Feature domain tree"
  - id: "boundary-source"
    resource: "apps/web/.dependency-cruiser.cjs"
    title: "Authoritative dependency graph configuration"
  - id: "layer-source"
    resource: "apps/web/scripts/check-boundaries.mjs"
    title: "Feature MVVM layer checker"
  - id: "ci-source"
    resource: ".github/workflows/ci.yml"
    title: "Continuous integration gate"
---

# Architecture check map

This snapshot is generated from the current source tree. It is descriptive evidence; the executable gates remain the commands in the verification table.

## Source metrics

| Area | Source files |
|---|---:|
| Feature domains | 751 |
| `src/shared` | 25 |
| `src/app` | 34 |

## Executable gates

| Gate | Command | Authority |
|---|---|---|
| Type safety | `npm run typecheck` | TypeScript compiler |
| Build | `npm run build` | Next.js production build |
| Lint | `npx eslint src --max-warnings=0` | ESLint |
| CSS | `npm run lint:css` | stylelint with the warning ceiling |
| Tests | `npm test` | Jest |
| Dependency boundaries | `npm run boundaries` | dependency-cruiser |
| Feature architecture | `npm run arch:check` | thin routes, view I/O, model purity |
| Capability surfaces | `npm run check:capabilities` | package surfaces, compatibility fields, and pack catalogs (the package itself: `npm run check:capability-package -w @alphaci/api`) |
| Documentation bundle | `npm run check:documentation` at the repository root | OKF v0.2 format, links, naming, current-state wording, generated-map drift, then each app's own check |
| App documentation | `npm run check:documentation` | edition and client branches and capability sources |

## Limits

Static gates do not prove a live backend session, provider API availability, or cross-origin cookie behavior. Those checks are covered by the session and local verification runbooks when the environment is configured.
