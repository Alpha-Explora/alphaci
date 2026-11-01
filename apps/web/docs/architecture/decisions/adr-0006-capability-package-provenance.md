---
type: "Architecture Decision Record"
title: "Capability package provenance"
description: "Verify that the frontend vendor fixture is the backend-generated capability catalog artifact."
tags: [architecture, capabilities, composition, package, integrity]
status: stable
timestamp: "2026-09-15T00:00:00Z"
sources:
  - id: capability-contract
    resource: "/capabilities/capability-contract.md"
    title: "Frontend capability contract"
  - id: package-provenance
    resource: "vendor/@alphaci/capability-catalog/provenance.json"
    title: "Vendored package provenance"
  - id: package-check
    resource: "scripts/check-capability-package.cjs"
    title: "Frontend package integrity gate"
---
# ADR-0006: Capability package provenance

**Decision date:** 2026-09-15
**Decision status:** Accepted
**Scope:** Integrity and source ownership of the vendored capability catalog

## Context

The backend owns `@alphaci/capability-catalog` and generates its catalog,
manifests, declarations, runtime entry point, and provenance. The frontend keeps
a checked-in vendor fixture because no package registry is part of this local
workflow. A catalog snapshot alone is insufficient: it is editable in the
frontend repository and cannot prove that the other generated package files
came from the backend artifact.

## Decision

The backend package includes `provenance.json` with stable package identity,
authoritative source metadata, a canonical catalog-source digest, and a
canonical artifact digest. The artifact digest covers the ordered generated
files `package.json`, `catalog.json`, `index.d.ts`, `index.js`, and
`manifests.json`; the provenance file is excluded to avoid a circular hash.

The frontend vendors that provenance file and checks it against the checked-in
expected release record at `docs/capabilities/catalog.provenance.json`. Its
package gate also recomputes the canonical digest over the vendor directory.
The catalog snapshot remains a documentation projection and does not become an
authority. Frontend CI does not require a sibling backend checkout; a future
source comparison is optional and separate from this gate.

## Rejected alternatives

- Comparing only the vendor catalog with the editable frontend snapshot was
  rejected because it could bless a locally changed package.
- Hashing a generated archive was rejected because archive metadata and entry
  ordering create avoidable platform variance.
- Making frontend CI read `catalog.source.json` from a sibling checkout was
  rejected because the vendor fixture must be independently verifiable.

## Consequences

- A backend package regeneration changes a reviewable provenance artifact and
  requires the frontend vendor fixture and expected record to be updated
  together.
- Package-file or provenance tampering fails the backend and frontend package
  gates before profile or documentation checks consume the artifact.
- The source digest identifies the backend authoring boundary without adding
  timestamps or machine-specific paths.

## Verification

Run `node scripts/check-capability-package.cjs` in both repositories and run
the focused package provenance tests. The frontend also runs its existing
catalog, profile, surface-registry, and documentation checks.
