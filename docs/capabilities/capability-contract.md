---
type: "Executable Contract"
title: "Capability contract"
description: "Current vocabulary for capability ownership, maturity, configuration, pack applicability, and web consumption."
tags: [capabilities, contracts, composition]
status: stable
sources:
  - id: compatibility-endpoint
    resource: "apps/api/src/modules/identity-access/capabilities/capabilities.controller.ts"
    title: "Current capability compatibility endpoint"
  - id: configuration
    resource: "apps/api/src/kernel/config/app.config.types.ts"
    title: "Application configuration"
  - id: capability-gate
    resource: "apps/api/scripts/check-capabilities.cjs"
    title: "Capability registry gate"
  - id: compatibility-client
    resource: "apps/web/src/features/capabilities/current/data/capabilities-api.ts"
    title: "Web capability compatibility client"
  - id: view-flags
    resource: "apps/web/src/features/capabilities/current/model/capability-flags.ts"
    title: "Web view-flag mapping"
  - id: surface-gate
    resource: "apps/web/scripts/check-capabilities.cjs"
    title: "Web capability surface gate"
---

# Capability contract

A capability is a named product behavior owned by one API bounded context. Capability keys are stable application identifiers; the application-owned registry and manifests describe the runtime composition, but do not add endpoints, flags, or persistence on their own. The web app consumes capabilities; it does not mint keys.

## Record shape

Each registry record contains:

| Field | Meaning |
|---|---|
| `key` | Stable lowercase capability identifier, scoped by owning context. |
| `context` | Bounded context that owns the behavior. |
| `description` | Current behavior in one sentence. |
| `maturity` | `stable`, `limited`, or `not-implemented`. |
| `configuration` | Current source of enablement or gating. |
| `configurationFlags` | Boolean `AppConfig` leaves, as `group.flag` paths, that gate the base capability. Checked against `apps/api/src/kernel/config/app.config.types.ts` in both directions. Optional adapter or provider-mode toggles are explicit `NON_CAPABILITY_FLAGS`; this list is empty when `maturity` is `not-implemented`. |
| `requires` | Capability keys this capability depends on. Edges must resolve and stay acyclic. |
| `surface` | How the web app presents the capability; see [Web surfaces](#web-surfaces). |

Edition applicability is owned by `apps/api/src/kernel/composition/manifests.ts`, not by individual capability records. The [capability matrix](/capabilities/capability-matrix.generated.md) is derived from the registry at `apps/api/src/kernel/composition/capability-registry.ts` and those manifests. The live `/api/v1/capabilities` response is a compatibility projection of the resolved deployment set: its existing nested fields remain available, with top-level `edition` and `capabilityKeys` identifying the active composition.

### Web surfaces

The `surface` block records how the web app presents a capability. The [surface matrix](/capabilities/surface-matrix.generated.md) lists them.

| Field | Meaning |
|---|---|
| `apiField` | Top-level `CapabilitiesResponse` field, or `null` when the compatibility endpoint does not expose the key. |
| `viewFlag` | `CapabilityViewFlags` boolean, or `null` when no view flag exists. |
| `domains` | Feature domains that present the behavior. |
| `routes` | App Router paths that present the behavior. |
| `featureBarrels` | Feature import barrels used by build-profile exclusion. |
| `artifactSymbols` | Real exported implementation symbols that an excluded profile must not contain; excluded barrels generate fail-closed named stubs for type-safe route composition. |

`deploymentOwnershipMode` and `hierarchyGithubSyncMode` are details of existing capabilities, not separate catalog keys.

## The catalog package

The API packages the public composition metadata as the workspace package `@alphaci/capability-catalog` (`packages/capability-catalog`), written by `npm run package:capability-catalog -w @alphaci/api`. The package contains stable keys, context, descriptions, maturity, edition applicability, dependency edges, configuration flags, and surface metadata. The web app resolves it through the npm workspace for its build profile, exclusion, and surface checks, and does not read the API's TypeScript source. Runtime availability still comes from the `/api/v1/capabilities` response; package metadata only describes the contract and the exclusion boundary.

The web app keeps one generated file under `apps/web/capabilities/`: `surface-registry.ts`, a view of the package-owned surfaces that its capability check compares with the package and with the compatibility response types. It is not a catalog source.

### Package provenance and integrity

The package also contains `provenance.json`. It records the package name and version, the source repository identifier `github.com/Alpha-Explora/alphaci`, the authoritative source path `apps/api/src/kernel/composition/catalog.source.json`, a catalog source digest, and a deterministic artifact digest. It contains no timestamps or checkout-specific paths.

The catalog source digest is SHA-256 over canonical JSON: object keys are sorted recursively while array order is preserved. The artifact digest is SHA-256 over the JSON encoding of filename/content pairs for this ordered canonical set: `package.json`, `catalog.json`, `index.d.ts`, `index.js`, and `manifests.json`. Text content is normalized to LF before hashing. `provenance.json` is excluded from that set to avoid a self-referential digest. The package generator and the API's `check:capability-package` implement this contract: the check rebuilds the package from the source, rejects any file that differs, and recomputes the artifact digest. It is the only integrity check; see [ADR-0022](/architecture/decisions/adr-0022-one-catalog-integrity-check.md).

## Request enforcement

The kernel `CapabilityGuard` enforces capabilities declared with `@RequiresCapability(...)` at the request boundary. No capability metadata means the guard allows the request. When metadata is present, it resolves through the subject-scoped `CAPABILITY_RESOLVER.for(...)` path, forwarding the authenticated session's optional `tenantId`; a missing capability is returned as a generic `404 Not Found` with the message `Requested capability is not available`. Handler metadata overrides class metadata. `SubscriptionGuard` is a separate kernel guard that reads Billing through the `SUBSCRIPTION_ACCESS` port and runs after composition, and the capability guard does not inspect subscription state. Gated controllers declare the guards in the order `SessionAuthGuard, CapabilityGuard, SubscriptionGuard`, so an absent capability answers 404 before an unentitled request answers 402.

### HTTP route coverage gate

Every HTTP handler must carry an explicit capability decision: capability metadata from `@RequiresCapability(...)` at class or handler scope, together with `CapabilityGuard` in `@UseGuards` at class or handler scope. The architecture test in `apps/api/tests/architecture/capability-route-coverage.spec.ts` enforces both conditions. An intentionally ungated handler belongs in that test's baseline under its normalized controller path, with one controller reason and an explicit handler-plus-HTTP-method entry. Adding a new handler to an existing baseline controller still requires adding that handler to the route list; remove entries when routes are deleted or become covered.

The request-scoped resolver is used by HTTP controllers and guards. Background consumers without an HTTP subject use the deployment-scoped resolver token, so boot-time workers such as the platform outbox relay do not inherit request scope. That path resolves the deployment composition only; tenant narrowing remains an explicit subject-scoped request concern.

`configuration` stays human-readable prose. `configurationFlags` is the machine-checked form of the base enablement claim: without it, a flag could be renamed in `app.config.types.ts` while the registry and the generated matrix both stayed green. Every boolean `AppConfig` leaf must be owned by exactly one implemented record or listed in the `NON_CAPABILITY_FLAGS` exemption set in `apps/api/scripts/check-capabilities.cjs`, which makes "this toggle is not a product capability" an explicit decision rather than an omission. Optional live/provider-mode toggles narrow a mode or adapter, not the base capability. Records with `maturity: not-implemented` use an empty `configurationFlags` array.

## Maturity

- `stable`: the API exposes the behavior as a supported compatibility surface.
- `limited`: the surface exists but is configuration-gated, snapshot/local, provider-dependent, or otherwise deliberately limited.
- `not-implemented`: the product area is explicitly absent from the API.

`not-implemented` is a useful negative declaration. It must not be interpreted as a disabled entitlement that runtime already resolves. A `not-implemented` record must not claim `AppConfig` flags or a compatibility field; both are added when the behavior exists.

Pack profiles project registry records with a fourth status, `not-applicable`, when the pack manifest does not contain the capability. That pack status is not a maturity value.

## Narrowing composition

Applicable capability composition is evaluated in this order:

```text
build profile -> edition manifest -> client policy -> deployment configuration -> tenant override
```

Each layer can narrow the set. No layer can enable a capability that is not present in the preceding layer.

The tenant override layer has no source. The manifest source accepts the request subject and ignores it, so every tenant of one deployment resolves the same set.

The web app may only hide surfaces the API already disabled or left unimplemented. For `runtime.client-composition`, the settings surface additionally requires the API-owned `clientComposition.enabled` projection and renders only the active deny-only client metadata.

### Composition configuration

| Variable | Values | Unset |
| --- | --- | --- |
| `ALPHACI_BUILD_PROFILE` | `hosted`, `enterprise` | `enterprise` |
| `ALPHACI_EDITION` | `saas`, `edu`, `enterprise` | `enterprise` |
| `ALPHACI_CLIENT` | a client ID registered in `apps/api/src/packs/enterprise/clients/index.ts` | no client policy |
| `ALPHACI_CLIENT_CONFIG` | path to a client policy document | no client policy |

An invalid value stops the API boot. The edition is read from the environment at startup in every profile. The boot also fails when the edition manifest names a capability outside the build profile. In `apps/api`, `npm run start:saas`, `start:edu`, `start:enterprise`, and `start:enterprise-client` set the profile, edition, and client together through `scripts/run-edition.mjs`. The web app reads `ALPHACI_BUILD_PROFILE` and `ALPHACI_EDITION` at build time.

### Resolution rules

`apps/api/src/kernel/composition/capability-resolver.ts` applies these rules:

- A capability is enabled only when every `configurationFlags` path resolves to exactly `true`. A missing or non-boolean value narrows it out.
- A `not-implemented` record never appears in the resolved set, even when a manifest lists it.
- A capability whose `requires` key was removed is removed too, until the set stops changing. The result keeps registry order.
- A duplicate registry key, an unknown or duplicate manifest key, a manifest out of registry order, an unknown `requires` key, or a `requires` cycle is an error.

Three injection tokens carry the composition. `CAPABILITY_RESOLVER` is request-scoped. `DEPLOYMENT_CAPABILITY_RESOLVER` is a singleton for workers and services without a request subject. `CAPABILITY_MANIFEST_SOURCE` is the replaceable manifest seam. `/api/v1/capabilities` reads the deployment set.

A client policy is a deny-only declaration for one client, selected by `ALPHACI_CLIENT` or supplied as a document at `ALPHACI_CLIENT_CONFIG`. It removes capability keys from the edition manifest and cannot introduce one. See [ADR-0009](/architecture/decisions/adr-0009-client-capability-policies.md).

## Naming and ownership

- Use lowercase dot-separated keys such as `runtime.env-provisioning`.
- Put provider-neutral capability keys in the owning API context, not under a provider name or a web feature folder name.
- Do not invent web-only capability keys.
- Record provider-specific availability in the provider map and pack notes.
- Record missing UI for an implemented key as an honest surface gap, not as `not-implemented`.
- Update the source record, the package, the web surface view, and the generated matrices with the code or configuration change that changes the behavior.

A capability change that alters keys, maturity, or edition applicability regenerates every pack profile in the same change. Pack tables are a comparable projection of this registry; they are not a second catalog.

## Ledger

The generated matrix describes the catalog as it stands. The [capability ledger](capability-ledger.generated.md) records how it got there, with one entry per lifecycle change: `added`, `removed`, `renamed`, `maturity-changed`, or `membership-changed`.

Entries live in `apps/api/capabilities/ledger.json` and are append-only. Each entry carries the composition hash of the catalog it describes, covering every key, maturity, dependency edge, configuration flag, and edition membership in registry order. `npm run check:capability-ledger` recomputes that hash and fails when the catalog moved without an entry, so the ledger cannot quietly fall behind the registry. Description and wording edits do not change the hash and do not require an entry.

Use `npm run ledger:record` in `apps/api` to append an entry; it computes the hash and refreshes the generated ledger. The summary and the reference are written by hand, because a record derived from history can say what changed but not why.

## Authoring

`apps/api/src/kernel/composition/catalog.source.json` is the authoring source. One record carries the capability, its pack membership, configuration flags, and its web surface, including any unique implementation symbols that profile checks must exclude. `capability-registry.ts`, `manifests.ts`, and the package are generated from it and must not be edited by hand; `npm run generate:composition` rewrites the registry/manifests and `npm run check:composition-source` rejects drift.

`npm run capability:new` in `apps/api` adds a capability in one command. It writes the record, regenerates the registry, the manifests, and the package, appends the ledger entry, then refreshes the web surface view, pack profiles, and generated maps. A configuration flag named by a record is code and still has to exist in `AppConfig`. See [ADR-0010](/architecture/decisions/adr-0010-single-authoring-source-for-composition.md).

## Verification

In `apps/api`, run `npm run check:capability-package`, `npm run check:capabilities`, `npm run check:capability-ledger`, `npm run check:composition-profiles`, and `npm run check:documentation`. In `apps/web`, run `npm run check:capabilities`, `npm run check:profiles`, and `npm run check:documentation`. At the repository root, run `npm run check:documentation`. Review any capability change against the [orthogonal axes decision](/architecture/decisions/adr-0002-orthogonal-product-axes.md), the [shared catalog decision](/architecture/decisions/adr-0018-shared-catalog-and-packs.md), and the [pack contract](/packs/pack-contract.md).
