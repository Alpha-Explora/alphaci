---
type: "Executable Contract"
title: "AlphaCI constitution"
description: "Current executable invariants for API context ownership, web feature ownership, composition, events, schemas, and documentation."
tags: [architecture, constitution, contracts]
status: stable
sources:
  - id: app-composition
    resource: "apps/api/src/app.module.ts"
    title: "Nest application composition root"
  - id: boundary-gates
    resource: "apps/api/scripts/check-application-boundaries.cjs"
    title: "API application boundary gate"
  - id: schema-gate
    resource: "apps/api/scripts/check-schema-ownership.cjs"
    title: "Schema ownership gate"
  - id: feature-tree
    resource: "apps/web/src/features"
    title: "Web feature domain tree"
  - id: web-boundary-gates
    resource: "apps/web/scripts/check-boundaries.mjs"
    title: "Web feature MVVM layer gate"
  - id: web-dependency-graph
    resource: "apps/web/.dependency-cruiser.cjs"
    title: "Web dependency graph gate"
  - id: capability-gate
    resource: "apps/web/scripts/check-capabilities.cjs"
    title: "Web capability surface gate"
---
# AlphaCI constitution

This document is the current contract for AlphaCI: the NestJS API in `apps/api` and the Next.js web app in `apps/web`. A code, schema, deployment, or documentation change that violates an invariant must update the relevant source and its verification evidence in the same change.

## API context ownership

The API has six bounded contexts: `identity-access`, `projects`, `pipelines`, `runtime`, `billing`, and `platform-ops`. The [bounded context map](/architecture/api/context-map.generated.md) is generated from the source tree.

- The technical kernel is shared infrastructure only and never imports a business context.
- A provider, deployment mode, capability, or pack is not an additional bounded context.
- Each context owns its application policy, persistence boundary, public index, and composition root.
- Cross-context production code uses a public index, serialisable contract, or focused injected port. Composition-only Nest module imports are allowed at context roots.

## Web feature ownership

The web app is one Next.js App Router deployable. Routes under `apps/web/src/app/` compose feature barrels. Business behavior lives in `apps/web/src/features/<domain>/`.

- A feature domain is a UI ownership boundary. It is not an API bounded context and not a pack.
- Cross-feature imports go through a domain or action `index.ts`.
- `src/shared/` sits below every feature and must not import a feature.
- Views must not fetch. Model files must not import React, Next, or perform I/O.
- Provider tokens, GitHub access tokens, and hosting credentials do not live in the browser. The web app talks only to the API base, which is same-origin `/api/v1` in the self-hosted image.

The [feature map](/architecture/web/feature-map.generated.md) and [route map](/architecture/web/route-map.generated.md) are generated from the source tree.

## Product axes

Edition, tenancy, deployment target, deployment mode (`ALPHACI_DEPLOYMENT_MODE`: managed `saas` or `selfhosted`), and feature flag are independent values. Editions compose from capability declarations; they do not create copied domain implementations. Neither app branches on edition: the API resolves capabilities from composition data, and the web app fixes its build profile and edition at build time (`apps/web/src/shared/composition/build-profile.ts`) and reads runtime enablement from `/api/v1/capabilities`.

The narrowing order is:

```text
build profile -> edition manifest -> client policy -> deployment configuration -> tenant override
```

A lower layer can hide what an upper layer provided; it cannot enable a capability that the build or selected edition does not provide. No web flag or tenant override may present a capability the catalog does not provide.

The [capability contract](/capabilities/capability-contract.md) and [pack contract](/packs/pack-contract.md) define the documentation-level representation of these values.

## Shared catalog

Capability keys, maturity, pack applicability, dependency edges, capability surfaces, and package provenance are authored once in `apps/api/src/kernel/composition/catalog.source.json` and published to the web app as the workspace package `@alphaci/capability-catalog` (`packages/capability-catalog`). The web app reads the package directly and keeps no copy of it. The API's `check:capability-package` is the only integrity check on the package.

## Runtime providers

Provider implementations belong to Runtime under `apps/api/src/modules/runtime/infrastructure/providers/`. Each provider is composed as one validated `RuntimeProviderPack`; a provider that advertises environment provisioning must contribute a matching runtime client. Other contexts consume provider-neutral contracts and catalog data. Provider-specific credentials, policies, workflow fragments, and adapters do not become shared business logic. The [provider map](/architecture/api/provider-map.generated.md) records the current registered providers.

## Events and outbox

The active event mechanism is the PostgreSQL table `platform.outbox_events`, processed by the platform-ops `OutboxRelayService`. The API runs it on in-process timers, and `apps/api/scripts/process-outbox.cjs` runs it as a one-shot job that `render.yaml` schedules for the managed deployment.

- The kernel topic registry is the allow-list and every registered topic has one handler.
- Every consumer claims rows through the same leased `FOR UPDATE SKIP LOCKED` path, so concurrent consumers never deliver one row at the same time.
- Critical hierarchy assignment transitions insert the state change and outbox row in one transaction.
- Audit and notification writes are explicit best-effort post-commit observability writes.
- Delivery is at-least-once. The relay uses short row leases, retry scheduling, and quarantine; handlers must be idempotent.

See the [event map](/architecture/api/events-map.generated.md) and [outbox relay runbook](/runbooks/runbook-outbox-relay.md).

## Schema ownership

Migration directories and inline SQL are checked against the six context owners. Existing cross-schema references are exact transition allowances in the source gate; new references require an explicit ownership decision. The [schema map](/architecture/api/schema-ownership.generated.md) is generated from that gate.

## Documentation contract

This bundle is the only documentation tree in the repository; `npm run check:documentation` fails when a `docs/` folder appears under `apps/` or `packages/`. Canonical documentation is repository-portable and current-state only. It must not depend on external session context, a branch, a checkout path, or a dated execution plan. New documents use lower-kebab-case names unless a conventional entrypoint requires otherwise. A product-wide concept has one document; a concept that belongs to one app sits under that app's folder. Every change that alters a documented contract updates the affected concept, generated map, `docs/log.md`, and the changed app's `CHANGELOG.md`.

The architecture checks for the [API](/architecture/api/architecture-checks.generated.md) and the [web app](/architecture/web/architecture-checks.generated.md), and the [local verification runbook](/runbooks/runbook-local-verification.md), are the executable navigation points for this rule.
