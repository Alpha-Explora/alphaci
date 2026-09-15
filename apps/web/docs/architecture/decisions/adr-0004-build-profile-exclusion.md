---
type: "Decision"
title: "Build profile exclusion"
description: "Exclude non-selected pack source from frontend artifacts and depend on a published capability catalog."
tags: [architecture, decision, packs, composition]
status: stable
timestamp: "2026-09-11T00:00:00Z"
sources:
  - id: shared-catalog
    resource: "/architecture/decisions/adr-0003-shared-catalog-and-packs.md"
    title: "Shared catalog and packs"
  - id: capability-contract
    resource: "/capabilities/capability-contract.md"
    title: "Capability contract"
---
# ADR-0004: Build profile exclusion

**Decision date:** 2026-09-11
**Decision status:** Accepted
**Scope:** Frontend build composition and catalog dependency

## Decision

This frontend remains one codebase with one route tree. It produces more than one artifact. Each artifact is built for a profile, which is a declared set of packs, and excludes feature source belonging to packs outside that set.

Exclusion is derived from the capability surface registry, which already records the domains and routes each capability owns. No pack-specific route tree, duplicated screen, or edition folder is introduced, and no edition comparison enters source.

The capability catalog is consumed as a versioned dependency owned by the backend. This repository currently keeps a local release fixture under `vendor/@alphaci/capability-catalog` because no package registry is configured; a sibling checkout is not a contract.

## Rejected alternatives

- Shipping every pack's source in one bundle was rejected. A browser bundle is delivered to the customer, so unselected pack code would be readable by customers who did not buy it.
- Duplicating the route tree per pack was rejected, consistent with ADR-0003.
- Synchronising the catalog through a sibling checkout was rejected as the contract. It cannot be verified by continuous integration.

## Consequences

- Each profile is built and verified separately.
- Route paths for excluded features may still appear in build output even when their implementation does not. Removing the paths themselves requires pruning the route tree before the build and is not adopted.
- Catalog drift becomes a reviewable package-artifact change instead of an unverified local step. The package check compares the local fixture with the documentation snapshot.
- Pack profiles and the capability matrix are updated by the change that implements profiles, not by this record.

## Verification

Each profile is resolved and its build aliases are checked for excluded feature barrels. The local catalog artifact is checked against the backend package shape; publication is a separate release operation.
