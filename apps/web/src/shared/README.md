# shared

Cross-feature building blocks. Any feature may import from here;
**`shared/` may never import from `features/`.**

| Folder    | Holds                                                         |
|-----------|---------------------------------------------------------------|
| `ui/`     | primitives with zero feature knowledge — button, card, field   |
| `layout/` | the app shell — nav, background, loaders                       |
| `api/`    | transport only — `request()`, error types, base URL            |
| `styles/` | design tokens, reset, base typography                          |
| `lib/`    | pure functions — no React, no fetch                            |

## Admission rule

Something enters `shared/` only when a **second** feature needs it. One
consumer means it belongs inside that feature.

This is the single rule that stops `shared/` becoming what
`components/product/` became — 17 files and 10,149 lines with no owner.

A primitive that knows what a "project" is does not belong here.

## On api/contracts.ts

contracts.ts is a **deliberate** shared surface, not a transitional file.
The backend is a modular monolith with one wire vocabulary; the frontend
mirrors that with one typed contract module that every feature data layer
consumes. Feature model/ files re-export the subset their slice uses, so a
backend contract change surfaces in exactly one place per feature.

The alternative - per-domain contract files - was evaluated and deferred:
it duplicates cross-domain enums (env providers, roles, slots) that the
backend defines once, and the mapping layer it requires would add ceremony
without changing what the views render. Revisit if the backend ever splits
into separately-versioned services.
