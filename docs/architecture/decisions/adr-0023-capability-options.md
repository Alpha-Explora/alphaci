---
type: "Architecture Decision Record"
title: "Capability options"
description: "A deployment changes how an available capability behaves through declared options with closed values and a default equal to current behavior, never through a branch on the client."
tags: [architecture, capabilities, composition, configuration, clients]
status: stable
sources:
  - id: catalog-source
    resource: "apps/api/src/kernel/composition/catalog.source.json"
    title: "Capability authoring source"
  - id: options
    resource: "apps/api/src/kernel/composition/capability-options.ts"
    title: "Option parsing and types"
  - id: options-port
    resource: "apps/api/src/kernel/composition/capability-options.port.ts"
    title: "Option injection token"
  - id: compatibility-endpoint
    resource: "apps/api/src/modules/identity-access/capabilities/api/capabilities.controller.ts"
    title: "Capability compatibility endpoint"
  - id: client-policies
    resource: "/architecture/decisions/adr-0009-client-capability-policies.md"
    title: "Client capability policies"
---
# ADR-0023: Capability options

**Decision date:** 2026-11-07
**Decision status:** Accepted
**Scope:** How one deployment changes the behavior of a capability it already runs

## Context

Every deployment runs the same artifact. A client policy (ADR-0009) can remove a capability for one client, and boolean configuration flags turn a capability on or off. Neither can say "on this deployment, this capability works differently": for example, that Product owners may write QA test cases where no QA team exists. Without a declared seam, that difference would arrive as an `if` on the client id, which ADR-0002 and the source checks forbid for editions and which would silently reach every other deployment of the same code.

## Decision

A **capability option** is a named setting on one capability record in `catalog.source.json`:

```json
{ "key": "testCaseAuthors", "env": "QA_TEST_CASE_AUTHORS",
  "description": "...", "values": ["qa-team", "qa-team-and-leads"], "default": "qa-team" }
```

- **Closed values.** An option lists at least two lowercase values. Any other value stops the API boot, as an invalid `ALPHACI_DEPLOYMENT_MODE` does.
- **The default is current behavior.** Adding an option never changes a deployment that does not set it. Its `apps/api/.env.example` line sets the default.
- **Deployment configuration layer.** An option is read from the environment once at boot. It sits after the client policy in the narrowing order and changes behavior only: it cannot enable a capability that an earlier layer removed, and a `not-implemented` capability cannot declare one.
- **One source.** The generator validates options and writes them into the registry. `AppConfig['composition'].options` holds the resolved values. Application services read them through `CAPABILITY_OPTIONS`, typed per capability, and pass them into pure domain rules as arguments.
- **Advertised with their capability.** `/api/v1/capabilities` adds `options` to a capability's block while that capability is enabled. A screen that needs an option reads it from that response, as it reads view flags (ADR-0017). Where the API already returns a permission computed with the option, the screen follows that permission instead.
- **No client branches.** A deployment's option values are its data; the code never compares a client id or edition to a literal. A client's values live in its `apps/api/deploy/env` preset.

## Rejected alternatives

- **An `if` on the client id.** It reaches every deployment of the artifact, cannot be tested per value, and fails the documentation checks.
- **Options inside the client policy document.** A policy only removes capabilities (ADR-0009). Mixing behavior into it would blur that guarantee and tie a behavior to a client name instead of a deployment.
- **Free-form values, such as a role list.** A closed set keeps every combination enumerable and testable.
- **A git branch or tag per deployment.** Tags decide when a deployment receives a version, not how it behaves; a branch per client drifts.

## Consequences

- Each option doubles the behaviors a capability can show, so options stay few, and each lands with tests for every value.
- Options are not in the `@alphaci/capability-catalog` package. Runtime values reach the web app only through `/api/v1/capabilities`.
- `check-capabilities` fails when an option's variable is missing from `.env.example` or documented with a value other than its default. Both documentation checks reject client-id comparisons against literals.

## Verification

`tests/architecture/composition-source.spec.ts` covers option validation and rendering. `capability-options.spec.ts` covers boot parsing and the port. `capabilities.controller.spec.ts` covers the response projection. Run `npm run check:capabilities`, `npm run check:composition-source`, and `npm run check:documentation`.

