# features

One directory per domain, using the same names as the backend's
`src/modules/` so a developer can move between repositories without
translating.

Layout follows the `next-feature-architecture` skill (v21). The checker that
enforces it is vendored at `scripts/check-boundaries.mjs`.

```
<domain>/
  model/    pure types + rules — no React, no Next, no fetch
  data/     the only I/O in the domain: repositories, DTO mapping
  index.ts  domain barrel — shared types only

  <action>/
    model/        types + rules for this action alone
    view-models/  use-*.ts: state, commands, status, user-safe error
    views/        JSX bound to a view-model — props in, events out
    index.ts      the action's public API
```

`model/` and `data/` at the domain level are the sanctioned share point
between actions of one domain. `notifications` uses this: `inbox` and
`preferences` both consume `notifications/model` and
`notifications/data`.

## Progressive depth

Reach for the shallowest level that fits. Empty ceremony folders are a
violation, not a placeholder.

| Level | When | Files |
|-------|------|-------|
| 0 static | presentational only | route ± view |
| **1 lean** | form / list / detail — **the default** | view + view-model + data (+ model) |
| 2 use-case | action shared across actors, or offline policy | + `use-cases/` |
| 3 wizard | explicitly multi-step | + `views/steps/` |

## Rules

1. `views/` may not fetch. A view receives data from a view-model.
   Type-only imports are exempt — they are erased at compile time and a view
   legitimately needs the shape of what it renders. It is the fetching that
   must live in the view-model.
2. No React, Next, or `"use client"` in `model/`. Rules are pure functions.
3. I/O lives in `data/` and nowhere else.
4. `app/` may import a barrel — a domain `index.ts` or an action
   `index.ts` — and `shared/`. Nothing deeper.
5. `components/` may import a feature barrel, never a feature's internals.
6. No feature may reach into another feature's internals. Within your own
   domain, `model/` and `data/` are reachable.
7. `shared/` may never import a feature.
8. An interactive view-model exposes `status` and a user-safe `error`.
9. One domain per change.

## Enforcement

Two gates, checking different things. Neither is convention.

| Command | Checks |
|---------|--------|
| `npm run boundaries` | the import graph: barrels, cycles, `shared/` purity |
| `npm run arch:check` | the layers: thin routes, I/O placement, React in `model/` |

`npm run boundaries` fails only on violations beyond
`.dependency-cruiser-known-violations.json`, so the count can fall and never
rise. `npm run arch:check:touched` scopes the layer rules to what you changed —
the unmigrated routes still carry known thin-page violations.

## Migration status

`notifications` is migrated. The remaining verticals still live in
`app/`, `components/`, `hooks/` and `lib/`, and are moved one domain at a
time as product work touches them — not on a schedule. `npm run arch:check`
reports what is left.
