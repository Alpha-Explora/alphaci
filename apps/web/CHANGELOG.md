# Changelog

## [Unreleased]

### Added

- Added the local `@alphaci/capability-catalog` release fixture, profile resolver, package drift gate, and build-profile checks for frontend exclusion.
- Added an OKF v0.2 current-state documentation bundle covering architecture, capabilities, composition packs, runbooks, and change history.
- Added a shared catalog snapshot and surface map so SaaS, EDU, and Enterprise pack profiles stay comparable with the backend Golden Copy.
- Added repository checks for OKF structure, lower-kebab documentation names, stale claims, edition branches, generated-map drift, and catalog snapshot matching.
- Added an executive Golden Copy report covering Enterprise-first priorities, parallel implementation workstreams, delivery gates, and evidence requirements.
- Added ADR-0004, recording build profile exclusion and the published capability catalog dependency.

### Changed

- Updated the local catalog fixture to release-compatible package metadata and made the CommonJS build helpers' lint boundaries explicit; package publication remains outside this local change.
- Retained catalog snapshot synchronization as a migration-only helper and moved its input from the removed documentation registry to the backend kernel registry.
- Changed capability and pack documentation checks to use the versioned package contract instead of a sibling backend checkout. Package publication remains outside this local change.
- Consolidated the root README and feature/shared notes so architecture and product status live in the documentation bundle.
- Made ADR-0003's rejected alternative precise, separating rejected pack duplication from permitted build-time exclusion.
