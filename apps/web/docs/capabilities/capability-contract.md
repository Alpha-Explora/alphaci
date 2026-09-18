---
type: "Executable Contract"
title: "Capability contract"
description: "Current vocabulary for consuming the shared capability catalog from the AlphaCI frontend."
tags: [capabilities, contracts, composition]
status: stable
sources:
  - id: compatibility-client
    resource: "src/features/capabilities/current/data/capabilities-api.ts"
    title: "Current capability compatibility client"
  - id: view-flags
    resource: "src/features/capabilities/current/model/capability-flags.ts"
    title: "View-flag mapping"
  - id: capability-gate
    resource: "scripts/check-capabilities.cjs"
    title: "Capability surface gate"
---
# Capability contract

A capability is a named product behavior owned by one backend bounded context. This frontend consumes capabilities; it does not mint keys.

## Record shape

The backend package publishes each capability's surface block. The frontend consumes that block; the checked-in registry below is generated only for the OKF documentation bundle.

| Field | Meaning |
|---|---|
| `key` | Shared catalog identifier, copied from the backend registry. |
| `apiField` | Top-level `CapabilitiesResponse` field, or `null` when the compatibility endpoint does not expose the key. |
| `viewFlag` | `CapabilityViewFlags` boolean, or `null` when no view flag exists. |
| `domains` | Feature domains that present the behavior. |
| `routes` | App Router paths that present the behavior. |
| `featureBarrels` | Feature import barrels used by build-profile exclusion. |
| `artifactSymbols` | Real exported implementation symbols that an excluded profile must not contain; excluded barrels generate fail-closed named stubs for type-safe route composition. |

The [generated matrix](/capabilities/capability-matrix.generated.md) is derived from the local `@alphaci/capability-catalog` package and its documentation snapshot. `surface-registry.ts` is generated from the package and is not a second source. The package metadata is intentionally separate from the live `/api/v1/capabilities` response. Runtime availability still comes from the backend response and its configuration projection; package metadata only describes the contract and exclusion boundary.

## Package provenance and integrity

The backend package includes `provenance.json` beside its catalog files. It
binds the package name and version to the stable source repository identifier
`github.com/Alpha-Explora/alphaci-golden-copy-be`, the authoritative source path
`src/kernel/composition/catalog.source.json`, the catalog source digest, and a
deterministic artifact digest. The digest contract covers the ordered files
`package.json`, `catalog.json`, `index.d.ts`, `index.js`, and `manifests.json`
with LF-normalized text; `provenance.json` is excluded to avoid a circular
hash.

The vendored package is the frontend build and profile input. The checked-in
`docs/capabilities/catalog.provenance.json` is the expected release record for
that vendor fixture, not a second source of catalog facts. The package drift
checker verifies the provenance fields and recomputes the canonical artifact
digest locally, so isolated frontend CI does not depend on a sibling backend
checkout. A future cross-repository source comparison may supplement this
check, but is not required for the frontend gate.

`deploymentOwnershipMode` and `hierarchyGithubSyncMode` are details of existing capabilities, not separate catalog keys.

## Maturity

Maturity values are owned by the backend catalog and snapshotted here:

- `stable`: the current backend exposes the behavior as a supported compatibility surface.
- `limited`: the surface exists but is configuration-gated, snapshot/local, provider-dependent, or otherwise deliberately limited.
- `not-implemented`: the product area is explicitly absent from the backend.

`not-implemented` is a useful negative declaration. It must not be interpreted as a disabled entitlement that this frontend already resolves. A `not-implemented` record must not claim a compatibility field.

Pack profiles project package records with a fourth status, `not-applicable`, when the pack edition is absent from `editions`. That pack status is not a maturity value.

## Narrowing composition

Applicable capability composition is evaluated in this order:

```text
build -> edition manifest -> deployment configuration -> tenant override
```

Each layer can narrow the set. No layer can enable a capability that is not present in the preceding layer. The frontend may only hide surfaces the backend already disabled or left unimplemented. For `runtime.client-composition`, the settings surface additionally requires the backend-owned `clientComposition.enabled` projection and renders only the active deny-only client metadata.

## Naming and ownership

- Do not invent frontend-only capability keys.
- Put provider-neutral keys in the owning backend context, not under a provider name or a feature folder name.
- Record missing UI for an implemented backend key as an honest surface gap, not as `not-implemented`.
- Update the backend source/package and regenerate the frontend snapshot, generated surface view, and matrix with the change that changes the behavior.

A capability change that alters keys, maturity, or edition applicability must update the backend package artifact and every pack profile in the same change. Pack tables are a comparable projection of the package; they are not a second catalog.

## Verification

Run `npm run check:capability-package`, `npm run check:capabilities`, `npm run check:profiles`, `npm run generate:architecture-maps -- --check`, and `npm run check:documentation`. Review any capability change against the [shared catalog decision](/architecture/decisions/adr-0003-shared-catalog-and-packs.md) and [pack contract](/packs/pack-contract.md). The capability check includes package drift, pack catalog completeness, and surface-map completeness.
