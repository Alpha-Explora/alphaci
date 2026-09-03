export const CAPABILITY_SURFACES = [
  {
    "key": "identity.workspaces",
    "apiField": "workspaces",
    "viewFlag": "workspacesEnabled",
    "domains": ["settings"],
    "routes": ["/settings"]
  },
  {
    "key": "identity.hierarchy",
    "apiField": "hierarchy",
    "viewFlag": "hierarchyEnabled",
    "domains": ["groups", "teams"],
    "routes": ["/teams", "/groups/[groupId]"]
  },
  {
    "key": "identity.sso-scim",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "identity.lms-lti",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "identity.cohort-policy",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "identity.edu-provisioning",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "identity.ferpa-workflows",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "identity.edition-entitlements",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "platform.audit-events",
    "apiField": "auditEvents",
    "viewFlag": "auditEventsEnabled",
    "domains": ["capabilities"],
    "routes": []
  },
  {
    "key": "platform.notifications",
    "apiField": "notifications",
    "viewFlag": "notificationsEnabled",
    "domains": ["notifications", "settings"],
    "routes": ["/inbox", "/settings"]
  },
  {
    "key": "platform.data-residency",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "billing.subscription-gate",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "billing.usage-quotas",
    "apiField": "usageQuotas",
    "viewFlag": "usageQuotasEnabled",
    "domains": ["capabilities"],
    "routes": []
  },
  {
    "key": "billing.checkout",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "runtime.env-provisioning",
    "apiField": "envProvisioning",
    "viewFlag": "envProvisioningEnabled",
    "domains": ["workflows", "projects"],
    "routes": ["/workflows", "/projects/[projectId]"]
  },
  {
    "key": "runtime.gcp-deployments",
    "apiField": null,
    "viewFlag": null,
    "domains": ["workflows", "projects"],
    "routes": ["/workflows", "/projects/[projectId]"]
  },
  {
    "key": "runtime.deployment-history",
    "apiField": "deploymentHistory",
    "viewFlag": "deploymentHistoryEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "runtime.preview-deployments",
    "apiField": "previewDeployments",
    "viewFlag": "previewDeploymentsEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "runtime.drift-detection",
    "apiField": "driftDetection",
    "viewFlag": "driftDetectionEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "runtime.drift-repair",
    "apiField": "driftRepair",
    "viewFlag": "driftRepairEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "runtime.managed-secrets",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "runtime.air-gap-packaging",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "runtime.customer-isolation",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  },
  {
    "key": "projects.sync-snapshots",
    "apiField": "projectSyncSnapshots",
    "viewFlag": "projectSyncSnapshotsEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "projects.workflow-settings-preview",
    "apiField": "workflowSettingsPreview",
    "viewFlag": "workflowSettingsPreviewEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "projects.workflow-update-pr",
    "apiField": "workflowUpdatePr",
    "viewFlag": "workflowUpdatePrEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "projects.target-management",
    "apiField": "projectTargetManagement",
    "viewFlag": "projectTargetManagementEnabled",
    "domains": ["projects"],
    "routes": ["/projects/[projectId]"]
  },
  {
    "key": "pipelines.ci-run-tracking",
    "apiField": "ciRunTracking",
    "viewFlag": "ciRunTrackingEnabled",
    "domains": ["runs", "projects"],
    "routes": ["/runs", "/projects/[projectId]"]
  },
  {
    "key": "pipelines.github-enterprise-server",
    "apiField": null,
    "viewFlag": null,
    "domains": [],
    "routes": []
  }
] as const;
