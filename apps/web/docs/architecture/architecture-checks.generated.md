---
type: "Architecture Checks"
title: "Architecture check map"
description: "Generated snapshot of frontend source metrics and the repository architecture gates."
tags: [architecture, checks, map, verification]
status: stable
sources:
  - id: "features"
    resource: "src/features"
    title: "Feature domain tree"
  - id: "boundary-source"
    resource: ".dependency-cruiser.cjs"
    title: "Authoritative dependency graph configuration"
  - id: "layer-source"
    resource: "scripts/check-boundaries.mjs"
    title: "Feature MVVM layer checker"
  - id: "ci-source"
    resource: ".github/workflows/boundaries.yml"
    title: "Continuous integration gate"
---

# Architecture check map

This snapshot is generated from the current source tree. It is descriptive evidence; the executable gates remain the commands in the verification table.

## Source metrics

| Area | Source files |
|---|---:|
| Feature domains | 662 |
| `src/shared` | 21 |
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
| Capability package and surfaces | `npm run check:capability-package` and `npm run check:capabilities` | package drift, compatibility fields, and pack catalogs |
| OKF bundle | `npm run check:okf` | OKF v0.2 bundle validator |
| Documentation | `npm run check:documentation` | naming, stale-claim, generated-map, and documentation policy checker |

## Limits

Static gates do not prove a live backend session, provider API availability, or cross-origin cookie behavior. Those checks are covered by the session and local verification runbooks when the environment is configured.
