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
- Runtime selection behavior: The build-time profile resolver projects the versioned catalog and aliases excluded feature barrels to fail-closed `notFound()` stubs. Runtime capability truth still comes from `/api/v1/capabilities`.
- Excluded frontend feature barrels: none in the current surface registry
- Current frontend applicability: The same Next.js application exposes the shared capability catalog. An institution-hosted or shared deployment target remains a separate deployment value.

## Capability status

This table lists every current catalog capability in package order. Status is derived from capability maturity and edition applicability. Pack-specific gaps that are not registry keys stay in Explicit non-support.

| Capability key | Status | Evidence or limit |
|---|---|---|
| `identity.workspaces` | `available` | Workspace membership and access management. Frontend surface: `/settings`. Configuration: workspaces.enabled. |
| `identity.hierarchy` | `available` | Hierarchy groups, systems, repositories, and assignments. Frontend surface: `/teams`, `/groups/[groupId]`. The hierarchy compatibility flag is loaded; Teams and group routes currently remain visible to authenticated users. Configuration: hierarchy.enabled. |
| `identity.sso-scim` | `not-applicable` | Not part of this pack composition. |
| `identity.lms-lti` | `not-implemented` | LMS and LTI education-platform integrations. No frontend surface. Not implemented in the backend catalog. |
| `identity.cohort-policy` | `not-implemented` | Cohort-specific access and policy rules. No frontend surface. Not implemented in the backend catalog. |
| `identity.edu-provisioning` | `not-implemented` | Education-specific identity provisioning. No frontend surface. Not implemented in the backend catalog. |
| `identity.ferpa-workflows` | `not-implemented` | FERPA-oriented education workflow automation. No frontend surface. Not implemented in the backend catalog. |
| `identity.edition-entitlements` | `not-implemented` | Runtime edition and pack entitlement resolution. No frontend surface. Not implemented in the backend catalog. |
| `platform.audit-events` | `available` | Project audit event recording through the application outbox. Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: auditEvents.enabled. |
| `platform.notifications` | `available` | In-app notification requests and persistence. Frontend surface: `/inbox`, `/settings`. Configuration: notifications.enabled. |
| `platform.data-residency` | `not-applicable` | Not part of this pack composition. |
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
| `projects.sync-snapshots` | `configuration-gated` | Project synchronization snapshot reads and findings. Frontend surface: `/projects/[projectId]`. Configuration: projectSyncSnapshots.enabled. |
| `projects.workflow-settings-preview` | `available` | Workflow settings preview and validation. Frontend surface: `/projects/[projectId]`. Configuration: workflowSettingsPreview.enabled. |
| `projects.workflow-update-pr` | `configuration-gated` | Workflow update pull-request requests. Frontend surface: `/projects/[projectId]`. Configuration: workflowUpdatePr.enabled. |
| `projects.target-management` | `available` | Project target management composition with Runtime. Frontend surface: `/projects/[projectId]`. Configuration: projectTargetManagement.enabled. |
| `pipelines.ci-run-tracking` | `configuration-gated` | CI run report ingestion and tracking. Frontend surface: `/runs`, `/projects/[projectId]`. Configuration: ciRunTracking.enabled. |
| `pipelines.github-enterprise-server` | `not-applicable` | Not part of this pack composition. |

## Build and exclusion

- Excluded capability keys: 6
- The build resolver aliases any excluded feature barrel to a `notFound()` stub. Route names may remain in the build manifest; implementation code is the excluded unit.

## Deployment scope

EDU is an edition composition reference. This frontend is one deployable and does not fork screens by edition.

## Configuration and entitlements

The narrowing order is `build -> edition manifest -> deployment configuration -> tenant override`. This frontend does not resolve EDU-specific entitlements at runtime.

## Explicit non-support

No additional non-registry product areas. Catalog rows with status `not-implemented` are the current EDU product gaps.

## Ownership and verification

- Feature owners: the domains in the [feature map](/architecture/feature-map.generated.md).
- Source: `@alphaci/capability-catalog@0.1.0`, `docs/capabilities/catalog.snapshot.json`, and `docs/capabilities/surface-registry.ts`.
- Verification: `npm run check:documentation`.
