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

## Editions, personas, and deployment

These controls answer different questions:

| Control | Current values or source | Question |
|---|---|---|
| Edition | `saas`, `edu`, `enterprise` | Which capabilities belong to this product composition? |
| Build profile | `hosted`, `enterprise` | Which edition implementations may the artifact contain? |
| Deployment mode | `saas`, `selfhosted` | How does AlphaCI run and select its storage rules? |
| Client policy | Enterprise deny-only deployment policy | Which included capabilities does this client disable? |
| Configuration and provider readiness | AppConfig flags and provider configuration | Can the deployment currently perform the behavior? |
| Persona and resource access | `member`, `qa`, `lead`, `admin`, plus workspace and repository scope | May this user perform this action on this resource? |
| Internal organization policy | `github.internalOrg` and the user's internal status | Who may sign in, and which billing exceptions apply? |

`internal` is not a fourth edition. Organization membership can restrict sign-in and mark a user internal. Internal status bypasses subscription checks, and usage quota checks exempt users with the stored internal flag. In self-hosted mode, `github.internalOrg` defaults to the enforced customer organization when no separate internal organization is configured. That status neither grants an administrator role nor adds capabilities to the edition.

These rules live in `apps/api/src/kernel/config/app.config-slices.ts`, the Identity auth membership gate, and the Billing subscription and usage services. Persona action rules live in `apps/api/src/kernel/rules/persona-access.rules.ts` and `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`; see the [persona workflow](../design/persona-workflow.md).

## Capabilities and individual features

One capability can cover several features, actions, and screens. The generated matrix counts capability records, not independently entitled features or screens. A feature's repository of origin does not establish its current edition membership.

Current examples show the distinction:

| Built behavior | Current composition decision | Inventory limit |
|---|---|---|
| Requirements, test cases, Project QA runs and sign-off | Shared `projects.qa-checklists`, plus role, resource, and workflow checks | Disabling release governance does not remove shared QA or relax release safety. |
| PO acceptance, iteration start and governed merge | Shared `projects.release-governance`, requiring `projects.qa-checklists` | Independent control; currently included in all three editions. Existing persona and release prerequisites still apply. |
| Host inventory, environment assignment, readiness, enrollment and agent delivery | Shared `runtime.managed-host-delivery`, requiring `runtime.env-provisioning` | User and machine HTTP paths are gated; explicit host project/target creation and host-delivered release registration/promotion are checked before external or persistence side effects. Provider discovery marks managed hosts unavailable when excluded, and host controls stop polling. Ordinary provider hosting stays under provisioning. |
| Client-composition settings | Enterprise `runtime.client-composition` | The policy narrows one deployment; it does not select an edition for each tenant. |
| Public landing pages | Web build-time SaaS edition gate | Landing UI exists even though the API catalog's `platform.public-site` record remains `not-implemented`. |
| Single-server appliance | `selfhosted` deployment mode | Appliance support does not establish the separate air-gap-packaging or customer-isolation capability claims. |

The catalog remains authoritative for composition. The [built feature inventory](feature-inventory.generated.md) describes reconciled behavior without creating new entitlements or claiming an exhaustive list of application behavior. Use the [feature assignment runbook](../runbooks/runbook-feature-assignment.md) to add or change a composition boundary.

### Descriptive feature inventory

The authoring document's optional top-level `features` array records individual built behaviors. It stays outside the runtime registry and public catalog records; the package's source digest still covers the complete authoring document. The API architecture-map generator produces the feature inventory, and its existing `--check` path rejects stale output.

Each entry has an `id`, `title`, `availability`, `implementation`, `permissions`, `prerequisites`, and `evidence`, with optional historical `origin`. Availability is one of `{kind: capability, key}`, `{kind: deployment, mode: selfhosted}`, or `{kind: web-build, edition}`. Capability entries inherit the referenced capability's current editions, maturity, and configuration. Deployment contracts and web build gates are displayed separately.

Feature identifiers must be unique. Implementation, permission, and evidence references must name existing repository files. Origin, when supplied, records a GitHub repository and full commit SHA; validation checks its shape, not the historical commit's meaning or reachability. Entries cannot contain edition grants, role allow-lists, or other unsupported fields. Permission references point to code rather than duplicating its allow-lists. File presence and recorded evidence do not prove runtime readiness.

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
| `options` | Optional. Settings that change how the capability behaves on one deployment; see [Capability options](#capability-options). |
| `surface` | How the web app presents the capability; see [Web surfaces](#web-surfaces). |

Authors set `editions` on records in `apps/api/src/kernel/composition/catalog.source.json`. The generated `manifests.ts` owns runtime edition applicability; the generated registry does not maintain a second edition list. The [capability matrix](/capabilities/capability-matrix.generated.md) is derived from that registry and those manifests. The live `/api/v1/capabilities` response is a compatibility projection of the resolved deployment set: its existing nested fields remain available, with top-level `edition` and `capabilityKeys` identifying the active composition.

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

The web app keeps no copy of the package. Its capability check compares the package's surfaces with the compatibility response types.

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

The tenant override layer has no tenant-backed source. `StaticCapabilityManifestSource.for(subject)` forwards the subject to the client-policy source, but the current policy sources return either no policy or the same single-client policy for every subject. Every tenant of one deployment therefore resolves the same composition. `/api/v1/capabilities` reads the deployment set; it is not a per-tenant entitlement endpoint.

Use one edition per deployment, with matching API startup and web build presets. Separate hosted SaaS and EDU deployments can share code while retaining explicit composition. Mixed-edition tenants in one API require a subject-bound source, advertisement and worker changes; that behavior is not implemented.

The web app may only hide surfaces the API already disabled or left unimplemented. For `runtime.client-composition`, the settings surface additionally requires the API-owned `clientComposition.enabled` projection and renders only the active deny-only client metadata.

### Composition configuration

| Variable | Values | Unset |
| --- | --- | --- |
| `ALPHACI_BUILD_PROFILE` | `hosted`, `enterprise` | `enterprise` |
| `ALPHACI_EDITION` | `saas`, `edu`, `enterprise` | `enterprise` |
| `ALPHACI_CLIENT` | a client ID registered in `apps/api/src/packs/enterprise/clients/index.ts` | no client policy |
| `ALPHACI_CLIENT_CONFIG` | path to a client policy document | no client policy |
| `RELEASE_GOVERNANCE_ENABLED` | `false` disables governed write actions | enabled |
| `MANAGED_HOST_DELIVERY_ENABLED` | `false` disables managed-host composition | enabled |

An invalid value stops the API boot. The edition is read from the environment at startup in every profile. The boot also fails when the edition manifest names a capability outside the build profile. In `apps/api`, `npm run start:saas`, `start:edu`, `start:enterprise`, `start:enterprise-client`, and `start:enterprise-internal` set the profile, edition, and client together through `scripts/run-edition.mjs`. The web app reads `ALPHACI_BUILD_PROFILE` and `ALPHACI_EDITION` at build time.

The two independent controls default on unless the value is exactly `false`, preserving existing SaaS, EDU and Enterprise access. Their required base capabilities and operational prerequisites still apply. Managed hosts additionally require `ONPREM_RELEASES_ENABLED=true`, signing, credentials and provider readiness. Disabling composition does not revoke an already running external workload or cancel an operation that was accepted earlier. Governance denial rejects the governed operation; it never bypasses QA, PO acceptance, resource access or merge safety checks. During an API-first or web-first rolling upgrade, the web uses the older base projection only when the new field is absent; an explicit new denial wins.

### Operator diagnostics

`alphaci-ctl composition` prints local deployment composition as JSON using the same configuration factory, build profile, manifest, deny-only client source and resolution algorithm as enforcement. It opens no database or provider connection. Each record is available or reports the first exclusion stage: build profile, edition, client policy, unimplemented maturity, configuration, or missing dependency. Flag and dependency names are printed; secret values are not.

This command does not evaluate a user's subscription, persona, resource access, provider readiness or workflow prerequisites; its `notEvaluated` field lists those limits. Public HTTP capability denials remain 404. Use the [feature assignment runbook](../runbooks/runbook-feature-assignment.md#diagnose-a-deployment) to investigate a denial.

### Resolution rules

`apps/api/src/kernel/composition/capability-resolver.ts` applies these rules:

- A capability is enabled only when every `configurationFlags` path resolves to exactly `true`. A missing or non-boolean value narrows it out.
- A `not-implemented` record never appears in the resolved set, even when a manifest lists it.
- A capability whose `requires` key was removed is removed too, until the set stops changing. The result keeps registry order.
- A duplicate registry key, an unknown or duplicate manifest key, a manifest out of registry order, an unknown `requires` key, or a `requires` cycle is an error.

Three injection tokens carry the composition. `CAPABILITY_RESOLVER` is request-scoped. `DEPLOYMENT_CAPABILITY_RESOLVER` is a singleton for workers and services without a request subject. `CAPABILITY_MANIFEST_SOURCE` is the replaceable manifest seam. `/api/v1/capabilities` reads the deployment set.

A client policy is a deny-only declaration for one client, selected by `ALPHACI_CLIENT` or supplied as a document at `ALPHACI_CLIENT_CONFIG`. It removes capability keys from the edition manifest and cannot introduce one. See [ADR-0009](/architecture/decisions/adr-0009-client-capability-policies.md).

### Capability options

An option changes how an available capability behaves on one deployment; it never enables one. A record declares it in `catalog.source.json` with `key` (camelCase), `env` (the variable that sets it), `description`, `values` (at least two lowercase slugs), and `default`, which is the behavior every deployment had before the option existed. See [ADR-0023](/architecture/decisions/adr-0023-capability-options.md).

- The API reads every option at boot into `AppConfig['composition'].options`. Unset or blank is the default; any other value outside `values` stops the boot.
- Services read a value through the `CAPABILITY_OPTIONS` token, typed per capability and option, and pass it into domain rules as an argument.
- `/api/v1/capabilities` adds an `options` object to a capability's block while the capability is enabled, so the web app reads options where it reads view flags.
- `apps/api/.env.example` documents every option variable with its default; `check-capabilities` enforces it.
- A client's option values belong in its `apps/api/deploy/env` preset. Source never compares a client id or edition to a literal; both documentation checks reject it.

## Naming and ownership

- Use lowercase dot-separated keys such as `runtime.env-provisioning`.
- Put provider-neutral capability keys in the owning API context, not under a provider name or a web feature folder name.
- Do not invent web-only capability keys.
- Record provider-specific availability in the provider map and pack notes.
- Record missing UI for an implemented key as an honest surface gap, not as `not-implemented`.
- Update the source record, the package, and the generated matrices with the code or configuration change that changes the behavior.

A capability change that alters keys, maturity, or edition applicability regenerates every pack profile in the same change. Pack tables are a comparable projection of this registry; they are not a second catalog.

## Ledger

The generated matrix describes the catalog as it stands. The [capability ledger](capability-ledger.generated.md) records how it got there, with one entry per lifecycle change: `added`, `removed`, `renamed`, `maturity-changed`, or `membership-changed`.

Entries live in `apps/api/capabilities/ledger.json` and are append-only. Each entry carries the composition hash of the catalog it describes, covering every key, maturity, dependency edge, configuration flag, and edition membership in registry order. `npm run check:capability-ledger` recomputes that hash and fails when the catalog moved without an entry, so the ledger cannot quietly fall behind the registry. Description and wording edits do not change the hash and do not require an entry.

Use `npm run ledger:record` in `apps/api` to append an entry; it computes the hash and refreshes the generated ledger. The summary and the reference are written by hand, because a record derived from history can say what changed but not why.

## Authoring

`apps/api/src/kernel/composition/catalog.source.json` is the authoring source. One record carries the capability, its pack membership, configuration flags, and its web surface, including any unique implementation symbols that profile checks must exclude. `capability-registry.ts`, `manifests.ts`, and the package are generated from it and must not be edited by hand; `npm run generate:composition` rewrites the registry/manifests and `npm run check:composition-source` rejects drift.

`npm run capability:new` in `apps/api` adds a capability in one command. It writes the record, regenerates the registry, the manifests, and the package, appends the ledger entry, then refreshes the pack profiles and generated maps. A configuration flag named by a record is code and still has to exist in `AppConfig`. See [ADR-0010](/architecture/decisions/adr-0010-single-authoring-source-for-composition.md).

The command defaults to `not-implemented` and creates metadata, not application behavior. Unknown, duplicate, or empty CLI edition selections are rejected before writes; source validation also rejects empty memberships. `--dry-run` validates the complete proposed source and prints `{dryRun: true, record}` without writing files or running generators. Use only `saas`, `edu`, and `enterprise`; `internal` is not an edition. The [feature assignment runbook](../runbooks/runbook-feature-assignment.md) covers new keys, membership changes, persona checks, and verification.

## Verification

In `apps/api`, run `npm run check:capability-package`, `npm run check:capabilities`, `npm run check:capability-ledger`, `npm run check:composition-profiles`, and `npm run check:documentation`. In `apps/web`, run `npm run check:capabilities`, `npm run check:profiles`, and `npm run check:documentation`. At the repository root, run `npm run check:documentation`. Review any capability change against the [orthogonal axes decision](/architecture/decisions/adr-0002-orthogonal-product-axes.md), the [shared catalog decision](/architecture/decisions/adr-0018-shared-catalog-and-packs.md), and the [pack contract](/packs/pack-contract.md).
