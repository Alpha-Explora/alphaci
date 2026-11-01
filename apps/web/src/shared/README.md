# shared

Canonical shared-layer rules live in the [current architecture](../../docs/architecture/current-architecture.md) and [constitution](../../docs/constitution.md).

`shared/` may never import from `features/`. Something enters `shared/` only when a second feature needs it.
