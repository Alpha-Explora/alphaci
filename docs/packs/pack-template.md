---
type: "Template"
title: "Composition pack profile template"
description: "Standard current-state headings for comparable AlphaCI composition pack profiles."
tags: [packs, template, contracts]
status: stable
sources:
  - id: pack-contract
    resource: "/packs/pack-contract.md"
    title: "Composition pack contract"
---
# Composition pack profile template

Every pack profile has the headings below. The web map generator writes them; this template records the shape it must keep.

## Identity

- Pack ID: `[saas|edu|enterprise]`
- Display name: `[name]`

## Current composition

- Build profile: `[profile]` (`[pack membership]`)
- API edition selection: `[how ALPHACI_EDITION selects the manifest]`
- API artifact exclusion: `[source roots and symbols absent from the compiled profile]`
- Web profile resolution: `[the profile resolver and fail-closed stubs]`
- Excluded web feature barrels: `[barrels]`
- Applicability: `[evidence]`

## Capability status

List every catalog capability in catalog order. Do not sample. Status must match the shared catalog rule in the [pack contract](pack-contract.md).

| Capability key | Status | Evidence or limit |
|---|---|---|
| `context.capability` | `available` / `configuration-gated` / `not-implemented` / `not-applicable` | `[evidence]` |

## Build and exclusion

[Excluded capability keys and how the web build removes their feature code.]

## Deployment scope

[Describe deployment targets separately from the pack identity.]

## Configuration and entitlements

[Record current configuration keys and narrowing behavior.]

## Explicit non-support

[Name product behaviors that are not registry keys. Registry-declared absences use `not-implemented` rows.]

## Ownership and verification

- Owners: `[API contexts and web feature domains]`
- Source: `[paths]`
- Verification: `[commands]`
