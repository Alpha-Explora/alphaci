---
type: "Executable Contract"
title: "Composition pack contract"
description: "Common current-state contract for SaaS, EDU, and Enterprise pack documentation."
tags: [packs, capabilities, contracts]
status: stable
sources:
  - id: pack-decision
    resource: "/architecture/decisions/adr-0003-composition-packs-and-entitlements.md"
    title: "Composition pack decision"
  - id: shared-catalog-decision
    resource: "/architecture/decisions/adr-0018-shared-catalog-and-packs.md"
    title: "Shared catalog and packs decision"
  - id: capability-contract
    resource: "/capabilities/capability-contract.md"
    title: "Capability contract"
---
# Composition pack contract

Each pack profile uses the same sections, capability vocabulary, and status values. A pack is a composition declaration and documentation boundary. It does not own business logic, provider adapters, migrations, core-table columns, feature domains, routes, wire contracts, or stylesheets.

## Required profile sections

1. **Identity** - stable pack ID and display name.
2. **Current composition** - the build profile, how each app selects the edition, and what each app excludes.
3. **Capability status** - every catalog capability in catalog order, with derived status.
4. **Build and exclusion** - excluded capability keys and how the web build excludes them.
5. **Deployment scope** - deployment-target facts without confusing them with edition.
6. **Configuration and entitlements** - narrowing values and current implementation limits.
7. **Explicit non-support** - product areas that are not registry keys.
8. **Ownership and verification** - source owners and review commands.

## Status vocabulary

- `available`: current compatibility surface is present.
- `configuration-gated`: the surface exists but requires configured flags or providers.
- `not-implemented`: this pack includes the capability, and the API does not provide it.
- `not-applicable`: this pack does not include the capability.

Pack status is derived from the catalog, not invented per pack:

- If the capability is absent from the pack's edition manifest, status is `not-applicable`.
- `stable` maps to `available`.
- `limited` maps to `configuration-gated`.
- `not-implemented` maps to `not-implemented`.

## Shared catalog rule

Every pack profile lists every capability key in catalog order. Edition applicability comes from `apps/api/src/kernel/composition/manifests.ts`, and the `@alphaci/capability-catalog` package carries the key, maturity, applicability, dependency, and surface contract to the web app. The three tables are comparable by row. Pack-specific product areas that are not registry keys belong only in Explicit non-support.

The profiles are generated: `npm run generate:architecture-maps -w @alphaci/web` writes all three from the package, and its `--check` mode fails on drift. `npm run check:capabilities` in either app rejects a pack table that samples, reorders, omits, or restates a status the catalog does not support. `npm run check:capability-package` verifies the package.

## Entitlement rule

Pack applicability narrows in this order:

```text
build profile -> edition manifest -> client policy -> deployment configuration -> tenant override
```

The profile is the artifact ceiling. The API validates `ALPHACI_BUILD_PROFILE` at boot and the resolver rejects a manifest outside that ceiling. Each API profile is compiled in isolation. The Enterprise profile owns the real client-policy source under `apps/api/src/packs/enterprise`; the hosted profile excludes that root and the unique `EnterpriseClientPolicyPack` symbol. The fail-closed compiled-output scanner proves the exclusion, while the profile-keyed loader keeps hosted runtime from importing the pack. The web build aliases the feature barrels of excluded capabilities to fail-closed `notFound()` stubs.

A profile must never imply that a tenant override or web flag can enable a capability absent from the build or pack composition.

## Update rule

A change to the shared catalog regenerates the package, the pack profiles, and the generated matrices in the same change. Record it in `docs/log.md` and the changed app's `CHANGELOG.md`. Change a pack's prose sections in the `PACKS` table of `apps/web/scripts/generate-architecture-maps.mjs`, keeping the three profiles structurally comparable with the [pack template](pack-template.md).
