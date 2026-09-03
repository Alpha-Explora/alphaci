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

Each surface record contains:

| Field | Meaning |
|---|---|
| `key` | Shared catalog identifier, copied from the backend registry. |
| `apiField` | Top-level `CapabilitiesResponse` field, or `null` when the compatibility endpoint does not expose the key. |
| `viewFlag` | `CapabilityViewFlags` boolean, or `null` when no view flag exists. |
| `domains` | Feature domains that present the behavior. |
| `routes` | App Router paths that present the behavior. |

The [generated matrix](/capabilities/capability-matrix.generated.md) is derived from `catalog.snapshot.json` and `surface-registry.ts`. The snapshot is intentionally separate from the live `/api/v1/capabilities` response.

`deploymentOwnershipMode` and `hierarchyGithubSyncMode` are details of existing capabilities, not separate catalog keys.

## Maturity

Maturity values are owned by the backend catalog and snapshotted here:

- `stable`: the current backend exposes the behavior as a supported compatibility surface.
- `limited`: the surface exists but is configuration-gated, snapshot/local, provider-dependent, or otherwise deliberately limited.
- `not-implemented`: the product area is explicitly absent from the backend.

`not-implemented` is a useful negative declaration. It must not be interpreted as a disabled entitlement that this frontend already resolves. A `not-implemented` record must not claim a compatibility field.

Pack profiles project snapshot records with a fourth status, `not-applicable`, when the pack edition is absent from `editions`. That pack status is not a maturity value.

## Narrowing composition

Applicable capability composition is evaluated in this order:

```text
build -> edition manifest -> deployment configuration -> tenant override
```

Each layer can narrow the set. No layer can enable a capability that is not present in the preceding layer. The frontend may only hide surfaces the backend already disabled or left unimplemented.

## Naming and ownership

- Do not invent frontend-only capability keys.
- Put provider-neutral keys in the owning backend context, not under a provider name or a feature folder name.
- Record missing UI for an implemented backend key as an honest surface gap, not as `not-implemented`.
- Update the snapshot, surface map, and generated matrix with the change that changes the behavior.

A capability change that alters keys, maturity, or edition applicability must update every pack profile in the same change. Pack tables are a comparable projection of the snapshot; they are not a second catalog.

## Verification

Run `npm run check:capabilities`, `npm run generate:architecture-maps -- --check`, and `npm run check:documentation`. Review any capability change against the [shared catalog decision](/architecture/decisions/adr-0003-shared-catalog-and-packs.md) and [pack contract](/packs/pack-contract.md). The capability check includes pack catalog completeness and sibling-registry snapshot matching when the backend checkout is present.
