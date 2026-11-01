---
type: "Decision"
title: "Capability consumption"
description: "Consume backend compatibility capabilities through one client and view-flag map; do not own a second catalog."
tags: [architecture, decision, capabilities]
status: stable
timestamp: "2026-09-03T00:00:00Z"
sources:
  - id: capability-client
    resource: "src/features/capabilities/current/data/capabilities-api.ts"
    title: "Current capability client"
  - id: view-flags
    resource: "src/features/capabilities/current/model/capability-flags.ts"
    title: "View-flag mapping"
  - id: compatibility-contract
    resource: "src/shared/api/contracts.ts"
    title: "CapabilitiesResponse wire type"
---
# ADR-0002: Capability consumption

**Decision date:** 2026-09-03
**Decision status:** Accepted
**Scope:** Frontend capability advertisement and UI gating

## Decision

The frontend consumes `GET /api/v1/capabilities` as the compatibility surface. View-models read boolean flags from that response. Documentation records the mapping from shared catalog keys to compatibility fields, view flags, domains, and routes.

The documentation snapshot is not imported by the application. It does not add endpoints, flags, or persistence.

## Rejected alternatives

- Copying the backend capability registry into application code was rejected.
- Branching screens with `edition === "edu"` was rejected.
- Treating a missing UI panel as proof that a backend capability does not exist was rejected.

## Consequences

- Optional screens can hide when the backend disables a flag.
- A loaded flag without a hiding panel is an honest current-state gap, not an implied product promise.
- Pack documents stay comparable with the backend because they project the same keys.

## Verification

`npm run check:capabilities` verifies snapshot order, compatibility field ownership, view-flag ownership, and pack catalog completeness.
