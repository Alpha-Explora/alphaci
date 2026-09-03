# Capabilities

* [Capability contract](capability-contract.md) - frontend consumption rules for the shared catalog.
* [Capability matrix](capability-matrix.generated.md) - generated current surface inventory.
* [Catalog snapshot](catalog.snapshot.json) - portable copy of the backend capability registry.
* [Surface registry](surface-registry.ts) - documentation source mapping keys to fields, flags, domains, and routes.

The snapshot documents the current compatibility surface. Pack profiles project the same keys. The snapshot is not imported by the application and does not implement runtime capability resolution.
