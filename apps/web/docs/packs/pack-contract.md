---
type: "Executable Contract"
title: "Composition pack contract"
description: "Common current-state contract for SaaS, EDU, and Enterprise frontend pack documentation."
tags: [packs, capabilities, contracts]
status: stable
sources:
  - id: pack-decision
    resource: "/architecture/decisions/adr-0003-shared-catalog-and-packs.md"
    title: "Shared catalog and packs decision"
  - id: capability-contract
    resource: "/capabilities/capability-contract.md"
    title: "Capability contract"
---
# Composition pack contract

Each pack profile uses the same sections, capability vocabulary, and status values. A pack is a composition declaration and documentation boundary. It does not own feature domains, routes, wire contracts, or stylesheets.

## Required profile sections

1. **Identity** - stable pack ID and display name.
2. **Current composition** - what the profile describes in this repository.
3. **Capability status** - every package capability in package order, with derived status.
4. **Deployment scope** - deployment-target facts without confusing them with edition.
5. **Configuration and entitlements** - narrowing values and current implementation limits.
6. **Explicit non-support** - product areas that are not registry keys.
7. **Ownership and verification** - source owners and review commands.

## Status vocabulary

- `available`: current compatibility surface is present.
- `configuration-gated`: the surface exists but requires configured flags or providers.
- `not-implemented`: this pack includes the capability, and the backend does not provide it.
- `not-applicable`: this pack does not include the capability.
Pack status is derived from the versioned capability package, not invented per pack:

- If the pack edition is absent from the capability `editions` list, status is `not-applicable`.
- `stable` maps to `available`.
- `limited` maps to `configuration-gated`.
- `not-implemented` maps to `not-implemented`.

## Shared catalog rule

Every pack profile lists every capability key from `@alphaci/capability-catalog` in package order. The three tables are comparable by row. Pack-specific product areas that are not registry keys belong only in Explicit non-support.

`npm run check:capabilities` rejects a pack table that samples, reorders, omits, or restates a capability status that the package does not support. `npm run check:capability-package` verifies the checked-in local artifact against the backend package contract.

## Entitlement rule

Pack applicability narrows in this order:

```text
build -> edition manifest -> deployment configuration -> tenant override
```

The profile must never imply that a tenant override or frontend flag can enable a capability absent from the build or pack composition.

## Update rule

Update every affected pack profile and the generated capability matrix when the package changes. Record the change in `docs/log.md` and `CHANGELOG.md`. Use the [pack template](pack-template.md) to keep the three profiles structurally comparable.
