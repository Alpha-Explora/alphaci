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
