# Capabilities

* [Capability contract](capability-contract.md) - vocabulary, narrowing rules, and how the web app consumes the catalog.
* [Capability matrix](capability-matrix.generated.md) - generated current capability inventory from the API registry.
* [Capability surface matrix](surface-matrix.generated.md) - generated web surfaces (compatibility fields, view flags, routes) for each capability.
* [Capability ledger](capability-ledger.generated.md) - generated history of capability lifecycle changes.

Capabilities are authored in `apps/api/src/kernel/composition/catalog.source.json`. `capability-registry.ts` and `manifests.ts` beside it are generated from that file and are not edited by hand. `npm run package:capability-catalog -w @alphaci/api` writes the `@alphaci/capability-catalog` workspace package (`packages/capability-catalog`) and its deterministic `provenance.json`, which the web app consumes. Pack profiles project the same keys; they are not a second catalog. The generated matrices are documentation, while the live `/api/v1/capabilities` response projects the request's resolved deployment composition.

The web app reads the package directly and keeps no copy of it.
