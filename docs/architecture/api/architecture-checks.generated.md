---
type: "Architecture Checks"
title: "Architecture check map"
description: "Generated snapshot of source metrics and the repository architecture gates."
tags: [architecture, checks, map, verification]
status: stable
sources:
  - id: "metrics-source"
    resource: "apps/api/scripts/report-architecture-metrics.cjs"
    title: "Architecture metrics generator"
  - id: "boundary-source"
    resource: "apps/api/.dependency-cruiser.cjs"
    title: "Authoritative dependency graph configuration"
  - id: "capability-gate"
    resource: "apps/api/scripts/check-capabilities.cjs"
    title: "Capability registry gate"
  - id: "ci-source"
    resource: ".github/workflows/ci.yml"
    title: "Continuous integration gate"
---

# Architecture check map

This snapshot is generated from the current source tree. It is descriptive evidence; the executable gates remain the commands in the verification table.

## Context metrics

| Context | Source files | Test files | Cross-context imports | Directional pairs | Contract imports | Application imports |
|---|---:|---:|---:|---:|---:|---:|
| `billing` | 21 | 5 | 0 | 0 | 0 | 0 |
| `identity-access` | 148 | 34 | 9 | 5 | 0 | 0 |
| `pipelines` | 87 | 33 | 1 | 1 | 0 | 0 |
| `platform-ops` | 37 | 10 | 0 | 0 | 0 | 0 |
| `projects` | 345 | 132 | 20 | 5 | 0 | 0 |
| `runtime` | 228 | 84 | 11 | 4 | 0 | 0 |

| Total | 866 | 298 | 41 | 15 | 0 | 0 |

Dead in-process adapters measured by the source report: **0**.

## Executable gates

| Gate | Command | Authority |
|---|---|---|
| Type safety | `npm run typecheck` | TypeScript compiler |
| Build | `npm run build` | TypeScript build configuration |
| Lint and tests | `npm run lint` and `npm test -- --ci` | ESLint and Jest |
| Dependency boundaries | `npm run boundaries` | dependency-cruiser |
| Application boundaries | `npm run check:application-boundaries` | cross-context contract/application rule checker |
| Provider encapsulation | `npm run check:provider-encapsulation` | provider ownership checker |
| Schema ownership | `npm run check:schema-ownership` | migration and inline SQL checker |
| Capability registry | `npm run check:capabilities` | AppConfig flag ownership, capability dependency, and pack catalog completeness checker |
| Migration order | `npm run db:apply:all -- --dry-run` | migration replay planner |
| Documentation bundle | `npm run check:documentation` at the repository root | OKF v0.2 format, links, naming, current-state wording, generated-map drift, then each app's own check |
| App documentation | `npm run check:documentation` | edition branches and capability sources |

## Limits

Static gates do not prove a live database connection, deployed cron execution, provider API availability, or external rollback. Those checks are covered by the relevant integration and operational runbooks when their environment is configured.
