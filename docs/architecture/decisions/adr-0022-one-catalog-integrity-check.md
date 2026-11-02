---
type: "Architecture Decision Record"
title: "One catalog integrity check"
description: "In the monorepo, the API's package check is the only integrity check on the capability catalog package, and the web app keeps no copies of it."
tags: [architecture, capabilities, composition, package, integrity]
status: stable
sources:
  - id: package-check
    resource: "apps/api/scripts/check-capability-package.cjs"
    title: "Capability package check"
  - id: package-provenance
    resource: "packages/capability-catalog/provenance.json"
    title: "Package provenance"
  - id: superseded
    resource: "/architecture/decisions/adr-0021-capability-package-provenance.md"
    title: "Superseded provenance decision"
---
# ADR-0022: One catalog integrity check

**Decision date:** 2026-11-02
**Decision status:** Accepted
**Scope:** Integrity of the `@alphaci/capability-catalog` package. Supersedes [ADR-0021](adr-0021-capability-package-provenance.md).

## Context

ADR-0021 had the web app keep its own copies of the catalog package's
provenance and catalog, and re-verify the package against them. Those copies
protected a vendored package that the web app could not regenerate. The API
and the web app now share one repository, and the package is the workspace
package `packages/capability-catalog`. The API's package check rebuilds it
from `apps/api/src/kernel/composition/catalog.source.json` and rejects any file
that differs, including `provenance.json` and the artifact digest. The web
copies were byte-for-byte equal to the package, and the web check repeated
the API's.

## Decision

The API's `check:capability-package` is the only integrity check on the
package. CI runs it whenever the package or the API changes, because a change
under `packages/` affects both apps.

The web app reads the package directly. It keeps no expected provenance
record, no catalog snapshot, no generated surface registry, and no copy of
the digest code. The web capability check compares the package's own
surfaces with the compatibility response types.

The provenance records `github.com/Alpha-Explora/alphaci` as its source
repository and `apps/api/src/kernel/composition/catalog.source.json` as its
authoritative source.

## Rejected alternatives

- Keeping the web copies was rejected. Every catalog change had to copy the
  same files twice, and the copies could not catch anything the API's check
  misses.
- Moving the digest code into a shared package was rejected. Only the API
  produces and verifies the package, so there is no second consumer.

## Consequences

- `npm run capability:new` regenerates the package, the pack profiles,
  and the maps, with nothing to copy by hand.
- The web image no longer copies a provenance record.
- If the package is ever published outside this repository, a consumer there
  needs its own integrity check again.

## Verification

Run `npm run check:capability-package -w @alphaci/api`. In `apps/web`, run
`npm run check:capabilities` and `npm run check:profiles`.
