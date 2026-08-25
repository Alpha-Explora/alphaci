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
5. Legacy `components/`, `hooks/`, and domain-specific `lib/` roots are retired;
   new code belongs to an owning feature or a domain-free shared module.
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

Both are strict and whole-tree, and both are at zero. There is no
known-violations baseline: there was one, and it is deleted, because a baseline
that grandfathers nothing is just a place for the next violation to hide.
`npm run arch:check:touched` still exists for a fast local check of what you
changed, but CI runs the whole tree.

If you add a violation, fix the edge. Do not regenerate a baseline to land it.

## Migration status

Every route is migrated. All 22 routes are one-line re-exports from a feature
slice, except `/`, `/login`, `/signup` and `/auth/callback`, which are small
enough to have nothing to extract.

Domains: `admin`, `auth`, `capabilities`, `groups`, `guide`, `home`,
`notifications`, `projects`, `runs`, `settings`, `teams`, `workflows`, and
`workspace`.

The migration is complete at the source-root level: no code files remain under
`src/components/`, `src/hooks/`, or domain-specific `src/lib/{api,auth,hosting,onboarding}/`.
Domain UI and orchestration now have one owner, and generic transport remains
only in `src/shared/api/`. Preserve this invariant when adding new features;
do not recreate a legacy compatibility root.
