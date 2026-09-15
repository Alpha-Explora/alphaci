---
type: "Capability Map"
title: "Capability matrix"
description: "Generated inventory of shared catalog keys and the frontend surfaces that consume them."
tags: [capabilities, map, packs]
status: stable
sources:
  - id: "catalog-package"
    resource: "vendor/@alphaci/capability-catalog"
    title: "Versioned capability catalog fixture"
  - id: "catalog-snapshot"
    resource: "docs/capabilities/catalog.snapshot.json"
    title: "Shared catalog snapshot"
  - id: "surface-registry"
    resource: "docs/capabilities/surface-registry.ts"
    title: "Frontend surface map"
  - id: "capability-endpoint"
    resource: "src/features/capabilities/current/data/capabilities-api.ts"
    title: "Compatibility capability client"
---

# Capability matrix

This matrix is generated from the versioned `@alphaci/capability-catalog` package and the frontend surface registry. The checked-in snapshot supplies the backend-owned descriptions and configuration notes used for documentation. This frontend does not replace `/api/v1/capabilities` and does not implement entitlement resolution.

| Capability key | Context | Maturity | Compatibility field | View flag | Frontend routes |
|---|---|---|---|---|---|
| `identity.workspaces` | `identity-access` | stable | `workspaces` | `workspacesEnabled` | `/settings` |
| `identity.hierarchy` | `identity-access` | stable | `hierarchy` | `hierarchyEnabled` | `/teams`, `/groups/[groupId]` |
| `identity.sso-scim` | `identity-access` | not-implemented | none | none | none |
| `identity.lms-lti` | `identity-access` | not-implemented | none | none | none |
| `identity.cohort-policy` | `identity-access` | not-implemented | none | none | none |
| `identity.edu-provisioning` | `identity-access` | not-implemented | none | none | none |
| `identity.ferpa-workflows` | `identity-access` | not-implemented | none | none | none |
| `identity.edition-entitlements` | `identity-access` | not-implemented | none | none | none |
| `platform.audit-events` | `platform-ops` | stable | `auditEvents` | `auditEventsEnabled` | none |
| `platform.notifications` | `platform-ops` | stable | `notifications` | `notificationsEnabled` | `/inbox`, `/settings` |
| `platform.data-residency` | `platform-ops` | not-implemented | none | none | none |
| `billing.subscription-gate` | `billing` | stable | none | none | none |
| `billing.usage-quotas` | `billing` | limited | `usageQuotas` | `usageQuotasEnabled` | none |
| `billing.checkout` | `billing` | not-implemented | none | none | none |
| `runtime.env-provisioning` | `runtime` | limited | `envProvisioning` | `envProvisioningEnabled` | `/workflows`, `/projects/[projectId]` |
| `runtime.gcp-deployments` | `runtime` | limited | none | none | `/workflows`, `/projects/[projectId]` |
| `runtime.deployment-history` | `runtime` | limited | `deploymentHistory` | `deploymentHistoryEnabled` | `/projects/[projectId]` |
| `runtime.preview-deployments` | `runtime` | limited | `previewDeployments` | `previewDeploymentsEnabled` | `/projects/[projectId]` |
| `runtime.drift-detection` | `runtime` | limited | `driftDetection` | `driftDetectionEnabled` | `/projects/[projectId]` |
| `runtime.drift-repair` | `runtime` | limited | `driftRepair` | `driftRepairEnabled` | `/projects/[projectId]` |
| `runtime.managed-secrets` | `runtime` | not-implemented | none | none | none |
| `runtime.air-gap-packaging` | `runtime` | not-implemented | none | none | none |
| `runtime.customer-isolation` | `runtime` | not-implemented | none | none | none |
| `runtime.client-composition` | `runtime` | limited | `clientComposition` | `clientCompositionEnabled` | `/settings` |
| `projects.sync-snapshots` | `projects` | limited | `projectSyncSnapshots` | `projectSyncSnapshotsEnabled` | `/projects/[projectId]` |
| `projects.workflow-settings-preview` | `projects` | stable | `workflowSettingsPreview` | `workflowSettingsPreviewEnabled` | `/projects/[projectId]` |
| `projects.workflow-update-pr` | `projects` | limited | `workflowUpdatePr` | `workflowUpdatePrEnabled` | `/projects/[projectId]` |
| `projects.target-management` | `projects` | stable | `projectTargetManagement` | `projectTargetManagementEnabled` | `/projects/[projectId]` |
| `pipelines.ci-run-tracking` | `pipelines` | limited | `ciRunTracking` | `ciRunTrackingEnabled` | `/runs`, `/projects/[projectId]` |
| `pipelines.github-enterprise-server` | `pipelines` | not-implemented | none | none | none |

## Interpretation

- **stable** and **limited** keys may have a compatibility field and a view flag.
- **not-implemented** keys must remain without a compatibility field until the backend provides the behavior.
- A loaded flag that does not yet hide a route is still recorded. The Teams and group routes currently remain visible to authenticated users even though `hierarchyEnabled` is loaded.

Pack profiles list every key in package order. Pack status is derived from maturity and edition applicability.
