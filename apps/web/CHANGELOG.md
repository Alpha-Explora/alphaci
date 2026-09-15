# Changelog

## [Unreleased]

### Added

- Added the real Enterprise client-composition settings surface, gated by the backend-owned capability/configuration projection and backed by the package-owned artifact symbol `EnterpriseClientCompositionSettingsView`.
- Added frontend profile tests proving hosted/EDU output aliases the excluded barrel to a fail-closed named stub and does not contain the Enterprise implementation symbol.
- Added backend-owned capability package provenance, a checked-in expected release record, canonical artifact-digest verification, and focused tamper tests for the vendored fixture.
- Added the local `@alphaci/capability-catalog` release fixture, profile resolver, package drift gate, and build-profile checks for frontend exclusion.
- Added an OKF v0.2 current-state documentation bundle covering architecture, capabilities, composition packs, runbooks, and change history.
- Added a shared catalog snapshot and surface map so SaaS, EDU, and Enterprise pack profiles stay comparable with the backend Golden Copy.
- Added repository checks for OKF structure, lower-kebab documentation names, stale claims, edition branches, generated-map drift, and catalog snapshot matching.
- Added an executive Golden Copy report covering Enterprise-first priorities, parallel implementation workstreams, delivery gates, and evidence requirements.
- Added ADR-0004, recording build profile exclusion and the published capability catalog dependency.
- Added ADR-0005, recording that capability surface data is consumed from the versioned package and is not frontend-owned.

### Changed

- Updated the local catalog fixture to `@alphaci/capability-catalog@0.2.0`, including typed capability surface data.
- Regenerated the capability snapshot and OKF surface view from the vendored package; frontend checks now fail on surface drift.
- Changed capability and pack documentation checks to use the versioned package contract instead of a sibling backend checkout. Package publication remains outside this local change.
- Consolidated the root README and feature/shared notes so architecture and product status live in the documentation bundle.
- Made ADR-0003's rejected alternative precise, separating rejected pack duplication from permitted build-time exclusion.
