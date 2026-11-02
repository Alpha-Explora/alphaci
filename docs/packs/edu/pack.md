---
type: "Composition Pack"
title: "EDU pack"
description: "Current EDU composition reference using the common pack contract."
tags: [packs, edu, composition]
status: stable
sources:
  - id: "pack-contract"
    resource: "/packs/pack-contract.md"
    title: "Common pack contract"
  - id: "capability-matrix"
    resource: "/capabilities/capability-matrix.generated.md"
    title: "Current capability matrix"
---

# EDU pack

## Identity

- Pack ID: `edu`
- Display name: `EDU`

## Current composition

- Build profile: `hosted` (`saas`, `edu`)
- API edition selection: `ALPHACI_EDITION=edu` selects the EDU manifest within the `hosted` build ceiling.
- API artifact exclusion: reserved EDU-only source root/marker declarations are absent from the compiled hosted API artifact; no EDU-only implementation exists yet.
- Web profile resolution: the build-time profile resolver projects the versioned catalog and aliases excluded feature barrels to fail-closed `notFound()` stubs. Runtime capability truth still comes from `/api/v1/capabilities`.
- Excluded web feature barrels: `@/features/settings/client-composition`
- Applicability: The same six-context API and the same Next.js application expose the shared capability catalog. An institution-hosted or shared deployment target remains a separate deployment value.

## Capability status

This table lists every current catalog capability in package order. Status is derived from capability maturity and edition applicability. Pack-specific gaps that are not registry keys stay in Explicit non-support.

| Capability key | Status | Evidence or limit |
|---|---|---|
| `identity.workspaces` | `available` | Workspace membership and access management. Frontend surface: `/settings`. Configuration: workspaces.enabled. |
| `identity.hierarchy` | `available` | Hierarchy groups, systems, repositories, and assignments. Frontend surface: `/teams`, `/groups/[groupId]`. The hierarchy compatibility flag is loaded; Teams and group routes currently remain visible to authenticated users. Configuration: hierarchy.enabled. |
| `identity.sso-scim` | `not-applicable` | Not part of this pack composition. |
| `identity.lms-lti` | `not-implemented` | LMS and LTI education-platform integrations. No frontend surface. Not implemented in the API. |
| `identity.cohort-policy` | `not-implemented` | Cohort-specific access and policy rules. No frontend surface. Not implemented in the API. |
| `identity.edu-provisioning` | `not-implemented` | Education-specific identity provisioning. No frontend surface. Not implemented in the API. |
| `identity.ferpa-workflows` | `not-implemented` | FERPA-oriented education workflow automation. No frontend surface. Not implemented in the API. |
| `identity.edition-entitlements` | `not-implemented` | Runtime edition and pack entitlement resolution. No frontend surface. Not implemented in the API. |
| `platform.audit-events` | `available` | Project audit event recording through the application outbox. Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: auditEvents.enabled. |
| `platform.notifications` | `available` | In-app notification requests and persistence. Frontend surface: `/inbox`, `/settings`. Configuration: notifications.enabled. |
| `platform.data-residency` | `not-applicable` | Not part of this pack composition. |
| `platform.public-site` | `not-applicable` | Not part of this pack composition. |
| `billing.subscription-gate` | `available` | Subscription entitlement gating for authenticated access and CI run validation. No paywall or `/subscribe` route. Access gating is enforced by the backend session. Configuration: subscription.gateEnabled. |
| `billing.usage-quotas` | `configuration-gated` | Usage tracking and quota policy checks. Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: usageQuotas.enabled. |
| `billing.checkout` | `not-applicable` | Not part of this pack composition. |
| `runtime.env-provisioning` | `configuration-gated` | Provider-backed deployment target and environment provisioning. Frontend surface: `/workflows`, `/projects/[projectId]`. Configuration: envProvisioning.enabled plus provider configuration. |
| `runtime.gcp-deployments` | `configuration-gated` | Google Cloud deployment provider, including optional dedicated per-customer projects. Advertised through `envProvisioning.providers` when GCP is registered. Configuration: gcpDeployments.enabled plus GCP provider configuration. |
| `runtime.deployment-history` | `configuration-gated` | Deployment history read model exposed through the Runtime context. Frontend surface: `/projects/[projectId]`. Configuration: deploymentHistory.enabled. |
| `runtime.preview-deployments` | `configuration-gated` | Branch-scoped preview deployment grouping when the provider supports it. Frontend surface: `/projects/[projectId]`. Configuration: previewDeployments.enabled and deploymentHistory.enabled. |
| `runtime.drift-detection` | `configuration-gated` | Configuration drift detection using the current local or provider snapshot mode. Frontend surface: `/projects/[projectId]`. Configuration: driftDetection.enabled. |
| `runtime.drift-repair` | `configuration-gated` | Safe drift repair using the current configured repair mode. Frontend surface: `/projects/[projectId]`. Configuration: driftRepair.enabled. |
| `runtime.managed-secrets` | `not-applicable` | Not part of this pack composition. |
| `runtime.air-gap-packaging` | `not-applicable` | Not part of this pack composition. |
| `runtime.customer-isolation` | `not-applicable` | Not part of this pack composition. |
| `runtime.client-composition` | `not-applicable` | Not part of this pack composition. |
| `projects.sync-snapshots` | `configuration-gated` | Project synchronization snapshot reads and findings. Frontend surface: `/projects/[projectId]`. Configuration: projectSyncSnapshots.enabled. |
| `projects.workflow-settings-preview` | `available` | Workflow settings preview and validation. Frontend surface: `/projects/[projectId]`. Configuration: workflowSettingsPreview.enabled. |
| `projects.workflow-update-pr` | `configuration-gated` | Workflow update pull-request requests. Frontend surface: `/projects/[projectId]`. Configuration: workflowUpdatePr.enabled. |
| `projects.target-management` | `available` | Project target management composition with Runtime. Frontend surface: `/projects/[projectId]`. Configuration: projectTargetManagement.enabled. |
| `projects.qa-checklists` | `configuration-gated` | QA checklist definitions and per-project sharing. Frontend surface: `/projects/[projectId]`, `/teams`. Configuration: qaChecklists.enabled. |
| `pipelines.ci-run-tracking` | `configuration-gated` | CI run report ingestion and tracking. Frontend surface: `/runs`, `/projects/[projectId]`. Configuration: ciRunTracking.enabled. |
| `pipelines.github-enterprise-server` | `not-applicable` | Not part of this pack composition. |

## Build and exclusion

- Excluded capability keys: 7
- The build resolver aliases any excluded feature barrel to a `notFound()` stub. Route names may remain in the build manifest; implementation code is the excluded unit.

## Deployment scope

EDU is an edition composition reference. An institution-hosted or shared deployment target remains a separate deployment value, and the web app does not fork screens by edition. Provider behavior is documented in the [provider map](/architecture/api/provider-map.generated.md).

## Configuration and entitlements

The narrowing order is `build profile -> edition manifest -> deployment configuration -> tenant override`. `ALPHACI_BUILD_PROFILE` defaults to `enterprise`; hosted builds must opt in explicitly. EDU-specific entitlements are not resolved by either app.

## Explicit non-support

No additional non-registry product areas. Catalog rows with status `not-implemented` are the current EDU product gaps.

## Ownership and verification

- Owners: the API contexts in the [capability matrix](/capabilities/capability-matrix.generated.md) and the web domains in the [feature map](/architecture/web/feature-map.generated.md).
- Source: `apps/api/src/kernel/composition/catalog.source.json`, published as `@alphaci/capability-catalog@0.2.0`.
- Verification: `npm run check:capabilities` and `npm run check:composition-profiles` in `apps/api`; `npm run check:documentation` in `apps/web` and at the repository root.
