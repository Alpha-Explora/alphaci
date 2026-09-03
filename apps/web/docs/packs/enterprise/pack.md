---
type: "Composition Pack"
title: "Enterprise pack"
description: "Current Enterprise composition reference using the common pack contract."
tags: [packs, enterprise, composition]
status: stable
sources:
  - id: "pack-contract"
    resource: "/packs/pack-contract.md"
    title: "Common pack contract"
  - id: "capability-matrix"
    resource: "/capabilities/capability-matrix.generated.md"
    title: "Current capability matrix"
---

# Enterprise pack

## Identity

- Pack ID: `enterprise`
- Display name: `Enterprise`

## Current composition

- Documentation status: `documentation-only`
- Runtime selection behavior: No pack-selection resolver is implemented in this frontend.
- Current frontend applicability: The same Next.js application exposes the shared capability catalog under the Enterprise evidence bar. A customer-managed deployment target remains separate from edition identity.

## Capability status

This table lists every current catalog capability in snapshot order. Status is derived from capability maturity and edition applicability. Pack-specific gaps that are not registry keys stay in Explicit non-support.

| Capability key | Status | Evidence or limit |
|---|---|---|
| `identity.workspaces` | `available` | Workspace membership and access management. Frontend surface: `/settings`. Configuration: workspaces.enabled. |
| `identity.hierarchy` | `available` | Hierarchy groups, systems, repositories, and assignments. Frontend surface: `/teams`, `/groups/[groupId]`. The hierarchy compatibility flag is loaded; Teams and group routes currently remain visible to authenticated users. Configuration: hierarchy.enabled. |
| `identity.sso-scim` | `not-implemented` | Single sign-on and SCIM user provisioning. No frontend surface. Not implemented in the backend catalog. |
| `identity.lms-lti` | `not-applicable` | Not part of this pack composition. |
| `identity.cohort-policy` | `not-applicable` | Not part of this pack composition. |
| `identity.edu-provisioning` | `not-applicable` | Not part of this pack composition. |
| `identity.ferpa-workflows` | `not-applicable` | Not part of this pack composition. |
| `identity.edition-entitlements` | `not-implemented` | Runtime edition and pack entitlement resolution. No frontend surface. Not implemented in the backend catalog. |
| `platform.audit-events` | `available` | Project audit event recording through the application outbox. Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: auditEvents.enabled. |
| `platform.notifications` | `available` | In-app notification requests and persistence. Frontend surface: `/inbox`, `/settings`. Configuration: notifications.enabled. |
| `platform.data-residency` | `not-implemented` | Customer-specific data-location controls. No frontend surface. Not implemented in the backend catalog. |
| `billing.subscription-gate` | `available` | Subscription entitlement gating for authenticated access and CI run validation. No paywall or `/subscribe` route. Access gating is enforced by the backend session. Configuration: subscription.gateEnabled. |
| `billing.usage-quotas` | `configuration-gated` | Usage tracking and quota policy checks. Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: usageQuotas.enabled. |
| `billing.checkout` | `not-applicable` | Not part of this pack composition. |
| `runtime.env-provisioning` | `configuration-gated` | Provider-backed deployment target and environment provisioning. Frontend surface: `/workflows`, `/projects/[projectId]`. Configuration: envProvisioning.enabled plus provider configuration. |
| `runtime.gcp-deployments` | `configuration-gated` | Google Cloud deployment provider, including optional dedicated per-customer projects. Advertised through `envProvisioning.providers` when GCP is registered. Configuration: gcpDeployments.enabled plus GCP provider configuration. |
| `runtime.deployment-history` | `configuration-gated` | Deployment history read model exposed through the Runtime context. Frontend surface: `/projects/[projectId]`. Configuration: deploymentHistory.enabled. |
| `runtime.preview-deployments` | `configuration-gated` | Branch-scoped preview deployment grouping when the provider supports it. Frontend surface: `/projects/[projectId]`. Configuration: previewDeployments.enabled and deploymentHistory.enabled. |
| `runtime.drift-detection` | `configuration-gated` | Configuration drift detection using the current local or provider snapshot mode. Frontend surface: `/projects/[projectId]`. Configuration: driftDetection.enabled. |
| `runtime.drift-repair` | `configuration-gated` | Safe drift repair using the current configured repair mode. Frontend surface: `/projects/[projectId]`. Configuration: driftRepair.enabled. |
| `runtime.managed-secrets` | `not-implemented` | Managed secret storage, including Vault integration. No frontend surface. Not implemented in the backend catalog. |
| `runtime.air-gap-packaging` | `not-implemented` | Air-gap packaging of the application as a deployment target. No frontend surface. Not implemented in the backend catalog. |
| `runtime.customer-isolation` | `not-implemented` | Customer-managed operational isolation as a tenancy option. No frontend surface. Not implemented in the backend catalog. |
| `projects.sync-snapshots` | `configuration-gated` | Project synchronization snapshot reads and findings. Frontend surface: `/projects/[projectId]`. Configuration: projectSyncSnapshots.enabled. |
| `projects.workflow-settings-preview` | `available` | Workflow settings preview and validation. Frontend surface: `/projects/[projectId]`. Configuration: workflowSettingsPreview.enabled. |
| `projects.workflow-update-pr` | `configuration-gated` | Workflow update pull-request requests. Frontend surface: `/projects/[projectId]`. Configuration: workflowUpdatePr.enabled. |
| `projects.target-management` | `available` | Project target management composition with Runtime. Frontend surface: `/projects/[projectId]`. Configuration: projectTargetManagement.enabled. |
| `pipelines.ci-run-tracking` | `configuration-gated` | CI run report ingestion and tracking. Frontend surface: `/runs`, `/projects/[projectId]`. Configuration: ciRunTracking.enabled. |
| `pipelines.github-enterprise-server` | `not-implemented` | GitHub Enterprise Server repository and CI integration. No frontend surface. Not implemented in the backend catalog. |

## Deployment scope

Enterprise is an edition composition reference. `runtime.air-gap-packaging` and `runtime.customer-isolation` are backend catalog keys with no frontend surface in this repository.

## Configuration and entitlements

The narrowing order is `build -> edition manifest -> deployment configuration -> tenant override`. The current frontend does not resolve Enterprise-specific entitlements; it records shared current surfaces and their limits.

## Explicit non-support

No additional non-registry product areas. Catalog rows with status `not-implemented` are the current Enterprise product gaps.

## Ownership and verification

- Feature owners: the domains in the [feature map](/architecture/feature-map.generated.md).
- Source: `docs/capabilities/catalog.snapshot.json` and `docs/capabilities/surface-registry.ts`.
- Verification: `npm run check:documentation`.
