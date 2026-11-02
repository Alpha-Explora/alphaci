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

- Build profile: `enterprise` (`enterprise`)
- API edition selection: `ALPHACI_EDITION=enterprise` selects the Enterprise manifest within the `enterprise` build ceiling.
- API artifact exclusion: reserved hosted source roots/markers are absent from the compiled Enterprise API artifact. The Enterprise client-policy implementation is real source under `apps/api/src/packs/enterprise` and is loaded through the profile-keyed pack seam.
- Web profile resolution: the build-time profile resolver projects the versioned catalog and aliases excluded feature barrels to fail-closed `notFound()` stubs. Runtime capability truth still comes from `/api/v1/capabilities`.
- Excluded web feature barrels: `@/features/public-site`
- Applicability: The same six-context API and the same Next.js application expose the shared capability catalog under the Enterprise evidence bar. A customer-managed deployment target remains separate from edition identity.

## Capability status

This table lists every current catalog capability in package order. Status is derived from capability maturity and edition applicability. Pack-specific gaps that are not registry keys stay in Explicit non-support.

| Capability key | Status | Evidence or limit |
|---|---|---|
| `identity.workspaces` | `available` | Workspace membership and access management. Frontend surface: `/settings`. Configuration: workspaces.enabled. |
| `identity.hierarchy` | `available` | Hierarchy groups, systems, repositories, and assignments. Frontend surface: `/teams`, `/groups/[groupId]`. The hierarchy compatibility flag is loaded; Teams and group routes currently remain visible to authenticated users. Configuration: hierarchy.enabled. |
| `identity.sso-scim` | `not-implemented` | Single sign-on and SCIM user provisioning. No frontend surface. Not implemented in the API. |
| `identity.lms-lti` | `not-applicable` | Not part of this pack composition. |
| `identity.cohort-policy` | `not-applicable` | Not part of this pack composition. |
| `identity.edu-provisioning` | `not-applicable` | Not part of this pack composition. |
| `identity.ferpa-workflows` | `not-applicable` | Not part of this pack composition. |
| `identity.edition-entitlements` | `not-implemented` | Runtime edition and pack entitlement resolution. No frontend surface. Not implemented in the API. |
| `platform.audit-events` | `available` | Project audit event recording through the application outbox. Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: auditEvents.enabled. |
| `platform.notifications` | `available` | In-app notification requests and persistence. Frontend surface: `/inbox`, `/settings`. Configuration: notifications.enabled. |
| `platform.data-residency` | `not-implemented` | Customer-specific data-location controls. No frontend surface. Not implemented in the API. |
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
| `runtime.managed-secrets` | `not-implemented` | Managed secret storage, including Vault integration. No frontend surface. Not implemented in the API. |
| `runtime.air-gap-packaging` | `not-implemented` | Air-gap packaging of the application as a deployment target. No frontend surface. Not implemented in the API. |
| `runtime.customer-isolation` | `not-implemented` | Customer-managed operational isolation as a tenancy option. No frontend surface. Not implemented in the API. |
| `runtime.client-composition` | `configuration-gated` | Enterprise client composition through a declared or deployment-mounted deny-only policy. Frontend surface: `/settings`. Configuration: composition.client.enabled and an Enterprise client policy source. |
| `projects.sync-snapshots` | `configuration-gated` | Project synchronization snapshot reads and findings. Frontend surface: `/projects/[projectId]`. Configuration: projectSyncSnapshots.enabled. |
| `projects.workflow-settings-preview` | `available` | Workflow settings preview and validation. Frontend surface: `/projects/[projectId]`. Configuration: workflowSettingsPreview.enabled. |
| `projects.workflow-update-pr` | `configuration-gated` | Workflow update pull-request requests. Frontend surface: `/projects/[projectId]`. Configuration: workflowUpdatePr.enabled. |
| `projects.target-management` | `available` | Project target management composition with Runtime. Frontend surface: `/projects/[projectId]`. Configuration: projectTargetManagement.enabled. |
| `projects.qa-checklists` | `configuration-gated` | QA checklist definitions and per-project sharing. Frontend surface: `/projects/[projectId]`, `/teams`. Configuration: qaChecklists.enabled. |
| `pipelines.ci-run-tracking` | `configuration-gated` | CI run report ingestion and tracking. Frontend surface: `/runs`, `/projects/[projectId]`. Configuration: ciRunTracking.enabled. |
| `pipelines.github-enterprise-server` | `not-implemented` | GitHub Enterprise Server repository and CI integration. No frontend surface. Not implemented in the API. |

## Build and exclusion

- Excluded capability keys: 6
- The build resolver aliases any excluded feature barrel to a `notFound()` stub. Route names may remain in the build manifest; implementation code is the excluded unit.

## Deployment scope

Enterprise is an edition composition reference. A customer-managed deployment target remains separate from edition identity. `runtime.client-composition` narrows the Enterprise manifest with a deny-only client policy selected at startup; it does not provide air-gap packaging or customer isolation. `runtime.air-gap-packaging` is a deployment-target capability and `runtime.customer-isolation` a tenancy capability composed into this pack; neither has a web surface, and neither replaces the Enterprise edition identity. The self-hosted appliance under `deploy/selfhost/` runs this edition with `ALPHACI_DEPLOYMENT_MODE=selfhosted`; the deployment mode is a separate axis and does not change the manifest. The current Runtime provider and GCP operational scope are described in the [provider map](/architecture/api/provider-map.generated.md) and [provisioning runbook](/runbooks/runbook-deployment-provisioning.md).

## Configuration and entitlements

The narrowing order is `build profile -> edition manifest -> client policy -> deployment configuration -> tenant override`. `ALPHACI_BUILD_PROFILE` defaults to `enterprise`. Enterprise-specific entitlements are not resolved by either app; the web app records shared current surfaces and their limits.

## Explicit non-support

No additional non-registry product areas. Catalog rows with status `not-implemented` are the current Enterprise product gaps.

## Ownership and verification

- Owners: the API contexts in the [capability matrix](/capabilities/capability-matrix.generated.md) and the web domains in the [feature map](/architecture/web/feature-map.generated.md).
- Source: `apps/api/src/kernel/composition/catalog.source.json`, published as `@alphaci/capability-catalog@0.2.0`; web surfaces in `apps/web/capabilities/surface-registry.ts`.
- Verification: `npm run check:capabilities` and `npm run check:composition-profiles` in `apps/api`; `npm run check:documentation` in `apps/web` and at the repository root.
