---
type: "Architecture Decision Record"
title: "Capability package provenance"
description: "Verify that the catalog package the web app consumes is the API-generated artifact."
tags: [architecture, capabilities, composition, package, integrity]
status: deprecated
timestamp: "2026-09-15T00:00:00Z"
sources:
  - id: capability-contract
    resource: "/capabilities/capability-contract.md"
    title: "Frontend capability contract"
  - id: package-provenance
    resource: "packages/capability-catalog/provenance.json"
    title: "Package provenance"
  - id: package-check
    resource: "apps/web/scripts/check-capability-package.cjs"
    title: "Frontend package integrity gate"
---
# ADR-0021: Capability package provenance

**Decision date:** 2026-09-15
**Decision status:** Superseded by [ADR-0022](adr-0022-one-catalog-integrity-check.md)
**Scope:** Integrity and source ownership of the capability catalog package

## Context

The backend owns `@alphaci/capability-catalog` and generates its catalog,
manifests, declarations, runtime entry point, and provenance. The web app
consumes the checked-in workspace package `packages/capability-catalog`. A
catalog snapshot alone is insufficient: it is editable in the web app and
cannot prove that the other generated package files came from the API
generator.

## Decision

The backend package includes `provenance.json` with stable package identity,
authoritative source metadata, a canonical catalog-source digest, and a
canonical artifact digest. The artifact digest covers the ordered generated
files `package.json`, `catalog.json`, `index.d.ts`, `index.js`, and
`manifests.json`; the provenance file is excluded to avoid a circular hash.

The web app checks that provenance file against the checked-in expected
release record at `apps/web/capabilities/catalog.provenance.json`. Its package
gate also recomputes the canonical digest over the package directory. The
catalog snapshot remains a documentation projection and does not become an
authority.

## Rejected alternatives

- Comparing only the vendor catalog with the editable frontend snapshot was
  rejected because it could bless a locally changed package.
- Hashing a generated archive was rejected because archive metadata and entry
  ordering create avoidable platform variance.
- Making frontend CI read `catalog.source.json` from a sibling checkout was
  rejected because the vendor fixture must be independently verifiable.

## Consequences

- A package regeneration changes a reviewable provenance artifact and
  requires the web app's expected record to be updated in the same change.
- Package-file or provenance tampering fails the backend and frontend package
  gates before profile or documentation checks consume the artifact.
- The source digest identifies the backend authoring boundary without adding
  timestamps or machine-specific paths.

## Verification

Run `node scripts/check-capability-package.cjs` in both apps and run the
focused package provenance tests. The web app also runs its catalog, profile,
surface-registry, and documentation checks.
