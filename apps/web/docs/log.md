# Directory Update Log

## 2026-09-11

* **Creation**: Recorded the build profile exclusion decision (ADR-0004). This frontend stays one codebase with one route tree and begins producing more than one artifact, each excluding feature source for packs outside its profile. Exclusion is derived from the capability surface registry, which already records the domains and routes each capability owns, so no route tree is duplicated. The capability catalog becomes a published versioned dependency, because a sibling checkout cannot be verified by continuous integration.
* **Update**: Made ADR-0003's rejected alternative precise. It rejected pack-specific route trees and edition folders, which reads as a ban on build-time exclusion; the intent was to reject duplication, so the bullet now separates duplicated screens from removing a pack's source from an artifact.

## 2026-09-03

* **Creation**: Established the current-state OKF v0.2 documentation bundle for the frontend.
* **Update**: Snapshotted the shared backend capability catalog and mapped compatibility fields, view flags, routes, and feature domains.
* **Update**: Added comparable SaaS, EDU, and Enterprise pack profiles derived from the shared snapshot.
* **Update**: Consolidated the root README and feature/shared notes so architecture and product status live in this bundle.
