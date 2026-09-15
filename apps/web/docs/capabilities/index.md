# Capabilities

* [Capability contract](capability-contract.md) - frontend consumption rules for the shared catalog.
* [Capability matrix](capability-matrix.generated.md) - generated current surface inventory.
* [Catalog snapshot](catalog.snapshot.json) - documentation mirror of the backend package metadata.
* [Surface registry](surface-registry.ts) - documentation source mapping keys to fields, flags, domains, and routes.

The local `@alphaci/capability-catalog` artifact is the frontend build and profile input. The snapshot keeps the richer documentation fields portable and is checked against the package. Pack profiles project the package keys; the live `/api/v1/capabilities` response remains the runtime compatibility surface.
