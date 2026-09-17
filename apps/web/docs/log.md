# Directory Update Log

## 2026-09-15

* **Creation**: Added the real Enterprise client-composition settings surface. It is gated by the backend-owned `runtime.client-composition` capability and `clientComposition.enabled` projection, while hosted/EDU profile stubs and artifact scans fail closed on the exported `EnterpriseClientCompositionSettingsView` symbol.

## 2026-09-11

* **Update**: Added the backend package's deterministic provenance artifact to the frontend vendor fixture, checked it against `docs/capabilities/catalog.provenance.json`, and made package drift checks recompute the canonical artifact digest without requiring a sibling checkout.
* **Creation**: Recorded ADR-0006. The frontend treats the backend-generated provenance as the package integrity boundary; the expected release record and documentation snapshot remain verification inputs rather than catalog owners.
* **Update**: Re-vendored `@alphaci/capability-catalog@0.2.0` with backend-owned capability surfaces, regenerated the catalog snapshot and surface view, and added package/snapshot/generated-file drift checks.
* **Creation**: Recorded ADR-0005. The frontend profile resolver consumes surface data from the versioned package; `docs/capabilities/surface-registry.ts` remains only as a generated OKF documentation view.

* **Update**: Updated the local `@alphaci/capability-catalog` fixture to the release package shape and added a package metadata/version gate; CommonJS build helpers are explicitly lint-scoped.
* **Update**: Kept catalog snapshot synchronization as a documentation helper; active frontend checks consume the local versioned package fixture.
* **Update**: Replaced sibling-checkout catalog consumption with the versioned `@alphaci/capability-catalog` contract. The local vendor directory is a release fixture for profile resolution and build exclusion checks; no package publication occurs in this local implementation.
* **Creation**: Recorded the build profile exclusion decision (ADR-0004). This frontend stays one codebase with one route tree and begins producing more than one artifact, each excluding feature source for packs outside its profile. Exclusion is derived from package-owned capability surfaces, so no route tree is duplicated. The capability catalog becomes a published versioned dependency, because a sibling checkout cannot be verified by continuous integration.
* **Update**: Made ADR-0003's rejected alternative precise. It rejected pack-specific route trees and edition folders, which reads as a ban on build-time exclusion; the intent was to reject duplication, so the bullet now separates duplicated screens from removing a pack's source from an artifact.

## 2026-09-03

* **Creation**: Established the current-state OKF v0.2 documentation bundle for the frontend.
* **Update**: Snapshotted the shared backend capability catalog and mapped compatibility fields, view flags, routes, and feature domains.
* **Update**: Added comparable SaaS, EDU, and Enterprise pack profiles derived from the shared snapshot.
* **Update**: Consolidated the root README and feature/shared notes so architecture and product status live in this bundle.
