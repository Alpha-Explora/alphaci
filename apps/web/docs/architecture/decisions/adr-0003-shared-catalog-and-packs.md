---
type: "Decision"
title: "Shared catalog and packs"
description: "Keep SaaS, EDU, and Enterprise as pack projections of one shared catalog rather than separate frontend products."
tags: [architecture, decision, packs, capabilities]
status: stable
timestamp: "2026-09-03T00:00:00Z"
sources:
  - id: pack-contract
    resource: "/packs/pack-contract.md"
    title: "Current pack contract"
  - id: catalog-snapshot
    resource: "docs/capabilities/catalog.snapshot.json"
    title: "Shared catalog snapshot"
---
# ADR-0003: Shared catalog and packs

**Decision date:** 2026-09-03
**Decision status:** Accepted
**Scope:** SaaS, EDU, and Enterprise frontend composition references

## Decision

SaaS, EDU, and Enterprise are composition packs of one product. This frontend is one application. A pack selects and documents capabilities; it does not own feature domains, routes, or wire contracts.

The frontend consumes the versioned `@alphaci/capability-catalog` package owned by the backend. The checked-in snapshot mirrors the package's public fields for portable documentation. Pack status is derived from catalog maturity and edition applicability, not invented per pack.

## Rejected alternatives

- A separate frontend implementation for each pack was rejected.
- Pack-specific route trees, duplicated screens, and edition folders were rejected. Removing a pack's source from a build artifact is not covered by this rejection; see ADR-0004.
- A tenant or environment toggle that shows a capability absent from the catalog was rejected.

## Consequences

- Pack documents can be compared without inferring missing behavior.
- Unsupported product areas are recorded as `not-implemented` rather than implied.
- Feature owners remain responsible for UI behavior. Catalog ownership stays in the backend repository.

## Verification

Review pack files against the [pack contract](/packs/pack-contract.md), the generated [capability matrix](/capabilities/capability-matrix.generated.md), and the [constitution](/constitution.md). The documentation check rejects edition branches in source code.
