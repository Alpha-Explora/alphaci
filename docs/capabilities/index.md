# Capabilities

* [Capability contract](capability-contract.md) - vocabulary, narrowing rules, and how the web app consumes the catalog.
* [Capability matrix](capability-matrix.generated.md) - generated current capability inventory from the API registry.
* [Built feature inventory](feature-inventory.generated.md) - individual built behaviors, inherited capability membership, controlling contracts, and implementation evidence.
* [Capability surface matrix](surface-matrix.generated.md) - generated web surfaces (compatibility fields, view flags, routes) for each capability.
* [Capability ledger](capability-ledger.generated.md) - generated history of capability lifecycle changes.
* [Assign a feature to editions and personas](../runbooks/runbook-feature-assignment.md) - contributor procedure for capability metadata, action permissions, and verification.

Capabilities are authored in `apps/api/src/kernel/composition/catalog.source.json`. `capability-registry.ts` and `manifests.ts` beside it are generated from that file and are not edited by hand. `npm run package:capability-catalog -w @alphaci/api` writes the `@alphaci/capability-catalog` workspace package (`packages/capability-catalog`) and its deterministic `provenance.json`, which the web app consumes. Pack profiles project the same keys; they are not a second catalog. The generated matrices are documentation, while the live `/api/v1/capabilities` response projects the request's resolved deployment composition.

The web app reads the package directly and keeps no copy of it. The matrix counts capability records rather than every built feature or screen. Editions, user personas, deployment mode, and internal organization policy are separate controls; the contract records their current behavior and inventory limits.
