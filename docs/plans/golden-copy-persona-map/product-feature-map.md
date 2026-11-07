# AlphaCI product features and current packs

Investigation snapshot: November 5, 2026. This map covers every current catalog capability, eight additional shared application areas, the web/deployment exceptions, and the reconciled historical journeys. It is a feature-area map, not an enumeration of every endpoint or button.

Membership and maturity come from the catalog. Shared code has no independent pack grant. Included does not bypass configuration, providers, subscriptions, personas or resource access. Planned means declared but not built.

**Internal is not a fourth pack.** It inherits the configured SaaS, EDU or Enterprise edition; organization/billing policy and user roles remain separate.

| Pack | Stable catalog records | Limited / configured | Planned, not built |
|---|---:|---:|---:|
| SaaS | 7 | 13 | 3 |
| EDU | 7 | 13 | 5 |
| Enterprise | 7 | 14 | 7 |

Counts refer only to catalog records. Shared application areas, appliance deployment and the web landing page are not extra catalog entitlements.

## Current catalog

| Feature | What it includes | SaaS | EDU | Enterprise | Status |
|---|---|---|---|---|---|
| Workspaces and membership (identity.workspaces) | Workspace selection, membership and scoped access. | Included | Included | Included | Stable |
| Teams, groups, systems and repository assignments (identity.hierarchy) | Groups and systems, team members, repository assignments and delivery-project organization. | Included | Included | Included | Stable |
| Enterprise SSO and user provisioning (identity.sso-scim) | Single sign-on and SCIM user provisioning. | — | — | Planned | Not built |
| LMS / LTI integration (identity.lms-lti) | LMS and LTI education-platform integrations. | — | Planned | — | Not built |
| Education cohort policies (identity.cohort-policy) | Cohort-specific access and policy rules. | — | Planned | — | Not built |
| Education identity provisioning (identity.edu-provisioning) | Education-specific identity provisioning. | — | Planned | — | Not built |
| FERPA-oriented workflows (identity.ferpa-workflows) | FERPA-oriented education workflow automation. | — | Planned | — | Not built |
| Runtime pack entitlements (identity.edition-entitlements) | Runtime edition and pack entitlement resolution. | Planned | Planned | Planned | Not built |
| Audit trail (platform.audit-events) | Project audit records delivered through the application outbox; project Audit view. | Included | Included | Included | Stable |
| Notifications and inbox (platform.notifications) | Notification inbox and preferences; recipient-scoped workspace membership updates; live stream with fetch fallback. | Included | Included | Included | Stable |
| Data residency controls (platform.data-residency) | Customer-specific data-location controls. | — | — | Planned | Not built |
| Public-site API capability (platform.public-site) | Public marketing site: landing, pricing, and guide pages served to unauthenticated visitors. | Planned | — | — | Not built |
| Contract subscription access (billing.subscription-gate) | Contract subscription checks for authenticated access and CI validation. Internal billing exceptions are separate. | Included | Included | Included | Stable |
| Usage and quotas (billing.usage-quotas) | Usage tracking and quota checks; does not provide payment checkout. | Included* | Included* | Included* | Limited / configured |
| Self-serve checkout (billing.checkout) | Self-serve payment checkout. | Planned | — | — | Not built |
| Hosting and environment provisioning (runtime.env-provisioning) | Provider-backed project environments, hosting operations, shared release registration, promotion and rollback.<br>Managed machines additionally require the managed-host capability; live provider support and credentials vary. | Included* | Included* | Included* | Limited / configured |
| Managed machines and signed delivery (runtime.managed-host-delivery) | Host inventory, enrollment codes and installers, machine credentials, environment assignments and readiness.<br>Signed releases, agent polling and status, host-delivered promotion and rollback; port, health and ingress configuration.<br>Requires environment provisioning, operator configuration, signing and registry setup. This is not school lab scheduling. | Included* | Included* | Included* | Limited / configured |
| Google Cloud deployments (runtime.gcp-deployments) | GCP provider integration; optional dedicated customer projects; requires provider configuration. | Included* | Included* | Included* | Limited / configured |
| Deployment history (runtime.deployment-history) | Deployment records, status and historical reads through Runtime. | Included* | Included* | Included* | Limited / configured |
| Branch deployment previews (runtime.preview-deployments) | Branch-scoped deployment grouping and preview links when the provider supports them; depends on deployment history. | Included* | Included* | Included* | Limited / configured |
| Configuration drift detection (runtime.drift-detection) | Snapshot-based configuration comparison and findings; behavior depends on configured local/provider mode. | Included* | Included* | Included* | Limited / configured |
| Configuration drift repair (runtime.drift-repair) | Repair requests using the configured safe repair mode; not an unrestricted infrastructure editor. | Included* | Included* | Included* | Limited / configured |
| Managed secrets / Vault (runtime.managed-secrets) | Managed secret storage, including Vault integration. | — | — | Planned | Not built |
| Air-gap packaging (runtime.air-gap-packaging) | Air-gap packaging of the application as a deployment target. | — | — | Planned | Not built |
| Customer operational isolation (runtime.customer-isolation) | Customer-managed operational isolation as a tenancy option. | — | — | Planned | Not built |
| Client-specific feature restrictions (runtime.client-composition) | Read-only Enterprise settings summary of a declared or mounted client policy that can remove capabilities; policy changes require deployment configuration and restart.<br>Does not grant new capabilities or assign different editions to tenants in one API. | — | — | Included* | Limited / configured |
| Project synchronization snapshots (projects.sync-snapshots) | Read synchronization snapshots and findings for a project. | Included* | Included* | Included* | Limited / configured |
| Workflow settings preview (projects.workflow-settings-preview) | Preview and validate proposed workflow settings before applying them. | Included | Included | Included | Stable |
| Workflow update pull requests (projects.workflow-update-pr) | Request a pull request containing workflow updates. | Included* | Included* | Included* | Limited / configured |
| Deployment target management (projects.target-management) | Connect project targets to Runtime deployment providers and environments. | Included | Included | Included | Stable |
| Requirements, checklists and QA (projects.qa-checklists) | Requirements: Features, User stories, system requirements and developer Progress.<br>Team checklist templates and sharing; story test cases and test suites.<br>QA Studio: project runs, UAT build verification, Passed/Failed/Pending results, severity, defects, screenshot evidence and sign-off.<br>Returned-by-QA / My QA items, retest workflow and QA reports.<br>PO acceptance, controlled merge and starting the next iteration use a separate governance control. | Included* | Included* | Included* | Limited / configured |
| Product acceptance and release governance (projects.release-governance) | PO Studio item acceptance after QA sign-off; controlled production merge / merge-all.<br>Iteration delivery and starting the next iteration; requires QA checklists and existing workflow safety rules. | Included* | Included* | Included* | Limited / configured |
| CI runs and reports (pipelines.ci-run-tracking) | CI report ingestion, run history, project Pipeline presentation and run details. | Included* | Included* | Included* | Limited / configured |
| GitHub Enterprise Server integration (pipelines.github-enterprise-server) | GitHub Enterprise Server repository and CI integration. | — | — | Planned | Not built |

## Shared application and other composition

| Feature | What it includes | SaaS | EDU | Enterprise | Status |
|---|---|---|---|---|---|
| Authentication and sessions (core.auth) | Sign-in, callback and session UI; current identity integration. Separate self-serve email/OAuth branch is not integrated. | Shared code | Shared code | Shared code | Shared application |
| Home dashboard and navigation (core.home) | Authenticated dashboard, workspace switching, application navigation and access-aware summaries. | Shared code | Shared code | Shared code | Shared application |
| Code and repository collaboration (core.repositories) | Repository browsing, file tree, commits, branches, pull request views and creation/routing subject to persona and GitHub access. | Shared code | Shared code | Shared code | Shared application |
| Project workspace and lifecycle (core.projects) | Project folders and repository switching; Overview, settings and lifecycle controls. Creation and management depend on persona and resource scope. | Shared code | Shared code | Shared code | Shared application |
| Create-project wizard and workflow studio (core.workflow-studio) | Repository/stack setup and workflow configuration. Hosting targets and optional operations require their own capabilities and providers. | Shared code | Shared code | Shared code | Shared application |
| Administration and feedback (core.admin) | Platform user review, user details and feedback administration; privileged access is required in every pack. | Shared code | Shared code | Shared code | Shared application |
| Account and workspace settings (core.settings) | Account/workspace settings and notification preferences. Enterprise client policy has a separate catalog key. | Shared code | Shared code | Shared code | Shared application |
| In-product guide (core.guide) | Application help/guide surface; distinct from the SaaS public landing page. | Shared code | Shared code | Shared code | Shared application |
| SaaS public landing pages (platform.public-landing) | Public SaaS marketing landing page. Pricing and guide capability scope does not establish a checkout implementation.<br>SaaS web build; platform.public-site remains unimplemented as an API capability | Included | — | — | Web only |
| Single-server AlphaCI appliance (runtime.selfhost-appliance) | One-server appliance: Caddy, API, web, migrator and PostgreSQL; local operator commands, persistent configuration and upgrades.<br>Customer-operated server, PostgreSQL, configured identity and signer; not an air-gap capability claim | Edition-independent | Edition-independent | Edition-independent | Deployment option |

## Historical journeys outside current packs

| Feature | What it includes | SaaS | EDU | Enterprise | Status |
|---|---|---|---|---|---|
| School organization and staff setup (EDU-01) | prototype-only<br>None identified. `identity.edu-provisioning` is declared but `not-implemented`.<br>The backend README describes a prototype using seeded in-memory mock data, with database use optional. Treat these endpoints as prototype evidence, not proof of a production-ready education tier. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Courses, classes, rosters, join-code enrollment (EDU-02) | prototype-only<br>No course/class API module identified. `identity.cohort-policy` is declared but `not-implemented`.<br>Code and migrations show a concrete school domain at this snapshot; the README qualification limits what can be claimed about operational persistence/readiness. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Teacher assignment creation and group editing (EDU-03) | prototype-only<br>No assignment domain equivalent identified.<br>Assignment and class controllers exist in the prototype backend. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Student repository submission, CI pipeline and hidden tests (EDU-04) | prototype-only<br>Partial shared substrate only: `projects.qa-checklists`; these do not establish school submission or hidden-test parity.<br>Historical implementation ties evaluation to assignments and students; current QA features are not an equivalent education journey. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Live lab sessions and lab machine operations (EDU-05) | prototype-only<br>No equivalent identified. `runtime.managed-host-delivery` covers managed hosts in the current catalog but not school lab scheduling or student lab sessions.<br>A separate education lab workflow is visible in source; do not merge its meaning into generic host management. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Scheduled class/lab availability and lab extension delivery (EDU-06) | branch-only<br>None identified.<br>The later branch adds scheduling, class access and extension artifact code. It is a branch snapshot, not evidence that those changes shipped on the backend main line. The separately inspected EDU frontend `main` `5aac58dacc8f32e39f4758b3a090ca8a42bda156` contains teacher schedule and class access views, but that does not prove backend merge/deployment. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Student, teacher, school admin and platform admin portals (EDU-07) | prototype-only<br>Current internal/persona navigation is not an education portal equivalent.<br>The UI has distinct school-facing journeys (class, assignment, reports, grades, lab setup). The presence of routes does not establish authorization or production readiness. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| LMS/LTI linkage (EDU-08) | absent-from-current; historical implementation not verified in inspected refs<br>`identity.lms-lti` (declaration only)<br>Keep this as an explicit unimplemented integration placeholder. Do not state that legacy LTI shipped or that the whole EDU product was retired. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Contract-entitled billing replacing payment checkout (SAAS-01) | replaced: contract subscription access; checkout explicitly removed<br>`billing.subscription-gate` enforces contract subscription access. `identity.edition-entitlements` and `billing.checkout` remain unimplemented placeholders; neither establishes self-serve billing.<br>The August 19 changes explicitly moved to contract billing and removed payment gateway/paywall flows. SaaS as an edition label therefore does not mean self-serve purchase currently exists. | Not integrated | Not integrated | Not integrated | Historical / not integrated |
| Email/OAuth self-serve account creation and sign-in (SAAS-02) | branch-only<br>No equivalent feature key or integrated implementation identified on monorepo main.<br>This commit is not an ancestor of Golden Copy backend main `b65a63f3103980b3cdb96e3ebb96d6ecea2298ea`. Record as an unmerged branch implementation, not as lost, shipped, or available. | Not integrated | Not integrated | Not integrated | Historical / not integrated |

## Frontend and personas

The [frontend/persona matrix](frontend-persona-map.md) maps all 28 current pages, all 12 project tabs, action controls and the client-policy card. It shows what each persona sees, permitted actions, hidden or blocked controls, backend differences and conditions. Pack membership is inherited from each linked feature owner.

## Per-feature controls and evidence

### Workspaces and membership

- Identifier: `identity.workspaces`.
- Conditions: workspaces.enabled
- Frontend surfaces: Account and workspace settings (/settings). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Teams, groups, systems and repository assignments

- Identifier: `identity.hierarchy`.
- Conditions: hierarchy.enabled
- Frontend surfaces: Team / group (/teams); Team / group (/groups/[groupId]); Team members (/groups/[groupId]/members); Systems (/groups/[groupId]/systems); Systems (/groups/[groupId]/systems/[systemId]); Team activity (/activity); Team activity (/groups/[groupId]/activity). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Enterprise SSO and user provisioning

- Identifier: `identity.sso-scim`.
- Conditions: Not implemented in this backend. No AppConfig flag.; requires identity.workspaces
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### LMS / LTI integration

- Identifier: `identity.lms-lti`.
- Conditions: Not implemented in this backend. No AppConfig flag.; requires identity.workspaces
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Education cohort policies

- Identifier: `identity.cohort-policy`.
- Conditions: Not implemented in this backend. No AppConfig flag.; requires identity.hierarchy
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Education identity provisioning

- Identifier: `identity.edu-provisioning`.
- Conditions: Not implemented in this backend. No AppConfig flag.; requires identity.workspaces
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### FERPA-oriented workflows

- Identifier: `identity.ferpa-workflows`.
- Conditions: Not implemented in this backend. No AppConfig flag.; requires identity.workspaces
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Runtime pack entitlements

- Identifier: `identity.edition-entitlements`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Audit trail

- Identifier: `platform.audit-events`.
- Conditions: auditEvents.enabled
- Frontend surfaces: Audit tab (/projects/[projectId]#audit). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Notifications and inbox

- Identifier: `platform.notifications`.
- Conditions: notifications.enabled
- Frontend surfaces: Notification inbox (/inbox); Account and workspace settings (/settings). See the frontend/persona matrix for actions.
- Reconciled subfeatures: Live workspace membership notifications.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`, `apps/api/src/modules/platform-ops/notifications/api/notifications.controller.ts`, `apps/web/src/features/notifications/data/notifications-stream.ts`.

### Data residency controls

- Identifier: `platform.data-residency`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Public-site API capability

- Identifier: `platform.public-site`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend surfaces: Public landing (/); Product guide (/guide). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Contract subscription access

- Identifier: `billing.subscription-gate`.
- Conditions: subscription.gateEnabled
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Usage and quotas

- Identifier: `billing.usage-quotas`.
- Conditions: usageQuotas.enabled
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Self-serve checkout

- Identifier: `billing.checkout`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Hosting and environment provisioning

- Identifier: `runtime.env-provisioning`.
- Conditions: envProvisioning.enabled plus provider configuration
- Frontend surfaces: Hosting tab (/projects/[projectId]#hosting); Manage hosting, variables, domains and CI secrets (/projects/[projectId]#hosting); Promote an environment release (/projects/[projectId]#hosting); Project detail (/projects/[projectId]); Create repository / workflow studio (/workflows); Managed host inventory (/hosts). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Managed machines and signed delivery

- Identifier: `runtime.managed-host-delivery`.
- Conditions: managedHostDelivery.enabled plus on-prem operator configuration; requires runtime.env-provisioning
- Frontend surfaces: Project detail (/projects/[projectId]); Create repository / workflow studio (/workflows); Managed host inventory (/hosts). See the frontend/persona matrix for actions.
- Reconciled subfeatures: Customer host inventory, enrollment, and assignment; Signed host release delivery, promotion, and rollback.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`, `apps/api/src/modules/runtime/api/onprem-hosts.controller.ts`, `apps/api/src/modules/runtime/api/onprem-enrollment.controller.ts`, `apps/web/src/app/(platform)/hosts/page.tsx`, `apps/api/src/modules/runtime/api/environment-releases.controller.ts`, `apps/api/src/modules/runtime/api/onprem-agent.controller.ts`, `apps/api/src/modules/runtime/api/releases.controller.ts`.

### Google Cloud deployments

- Identifier: `runtime.gcp-deployments`.
- Conditions: gcpDeployments.enabled plus GCP provider configuration
- Frontend surfaces: Project detail (/projects/[projectId]); Create repository / workflow studio (/workflows). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Deployment history

- Identifier: `runtime.deployment-history`.
- Conditions: deploymentHistory.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Branch deployment previews

- Identifier: `runtime.preview-deployments`.
- Conditions: previewDeployments.enabled and deploymentHistory.enabled; requires runtime.deployment-history
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Configuration drift detection

- Identifier: `runtime.drift-detection`.
- Conditions: driftDetection.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Configuration drift repair

- Identifier: `runtime.drift-repair`.
- Conditions: driftRepair.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Managed secrets / Vault

- Identifier: `runtime.managed-secrets`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Air-gap packaging

- Identifier: `runtime.air-gap-packaging`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Customer operational isolation

- Identifier: `runtime.customer-isolation`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Client-specific feature restrictions

- Identifier: `runtime.client-composition`.
- Conditions: composition.client.enabled and an Enterprise client policy source
- Frontend surfaces: Account and workspace settings (/settings); Enterprise client-policy summary (/settings). See the frontend/persona matrix for actions.
- Reconciled subfeatures: Enterprise client-composition settings.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`, `apps/api/src/packs/enterprise/client-policy-source.ts`, `apps/web/src/features/settings/client-composition/views/enterprise-client-composition-settings-view.tsx`.

### Project synchronization snapshots

- Identifier: `projects.sync-snapshots`.
- Conditions: projectSyncSnapshots.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Workflow settings preview

- Identifier: `projects.workflow-settings-preview`.
- Conditions: workflowSettingsPreview.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Workflow update pull requests

- Identifier: `projects.workflow-update-pr`.
- Conditions: workflowUpdatePr.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Deployment target management

- Identifier: `projects.target-management`.
- Conditions: projectTargetManagement.enabled
- Frontend surfaces: Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Requirements, checklists and QA

- Identifier: `projects.qa-checklists`.
- Conditions: qaChecklists.enabled
- Frontend surfaces: Requirements / Checklists tab (/projects/[projectId]#checklists); QA Studio tab (/projects/[projectId]#qa); PO Studio tab (/projects/[projectId]#po); History tab (/projects/[projectId]#history); Create/edit requirements (/projects/[projectId]#checklists); Developer Progress / request retest (/projects/[projectId]#checklists); Author test cases and record test results (/projects/[projectId]#checklists); Verification, evidence, automation and sign-off (/projects/[projectId]#qa); QA report (/projects/[projectId]/qa/report/[runId]); QA report (/qa/project-report/[deliveryProjectId]/[runId]); Project detail (/projects/[projectId]); Team / group (/teams); Legacy team checklists (/checklists). See the frontend/persona matrix for actions.
- Reconciled subfeatures: Project requirements and developer progress; User-story test cases and QA execution; Project QA runs, screenshot evidence, and sign-off.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`, `apps/api/src/modules/projects/api/qa-requirements.controller.ts`, `apps/api/src/modules/projects/api/qa-checklists.controller.ts`, `apps/api/src/modules/projects/api/qa-project-runs.controller.ts`, `apps/api/src/modules/projects/api/qa-project-runs.controller.ts`, `apps/api/src/modules/projects/api/qa-run-attachments.controller.ts`.

### Product acceptance and release governance

- Identifier: `projects.release-governance`.
- Conditions: releaseGovernance.enabled; existing QA and workflow safety gates remain mandatory; requires projects.qa-checklists
- Frontend surfaces: Accept QA items / merge to production (/projects/[projectId]#po); Start next iteration (/projects/[projectId]#checklists); Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Reconciled subfeatures: PO acceptance and controlled merge to production; Iteration delivery and carry-forward.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`, `apps/api/src/modules/projects/api/qa-runs.controller.ts`, `apps/api/src/modules/projects/api/project-iterations.controller.ts`.

### CI runs and reports

- Identifier: `pipelines.ci-run-tracking`.
- Conditions: ciRunTracking.enabled
- Frontend surfaces: Pipeline tab (/projects/[projectId]#pipeline); CI runs (/runs); CI run report (/runs/report); Project detail (/projects/[projectId]). See the frontend/persona matrix for actions.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### GitHub Enterprise Server integration

- Identifier: `pipelines.github-enterprise-server`.
- Conditions: Not implemented in this backend. No AppConfig flag.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `apps/api/src/kernel/composition/catalog.source.json`.

### Authentication and sessions

- Identifier: `core.auth`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Sign-in and callback (/login); Sign-in and callback (/auth/callback); Sign-up redirect (/signup). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/auth`.

### Home dashboard and navigation

- Identifier: `core.home`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Home dashboard (/home). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/home`.

### Code and repository collaboration

- Identifier: `core.repositories`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Code tab (/projects/[projectId]#code); Commits tab (/projects/[projectId]#commits); Pull requests tab (/projects/[projectId]#pulls); Create/merge repository pull requests (/projects/[projectId]#pulls); Group repository (/groups/[groupId]/repositories/[repositoryId]). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/projects`.

### Project workspace and lifecycle

- Identifier: `core.projects`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Overview tab (/projects/[projectId]#overview); Project settings tab (/projects/[projectId]#settings); Project detail (/projects/[projectId]); Project requirements workspace (/groups/[groupId]/delivery-projects/[deliveryProjectId]). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/projects`.

### Create-project wizard and workflow studio

- Identifier: `core.workflow-studio`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Create repository / workflow studio (/workflows). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/workflows`.

### Administration and feedback

- Identifier: `core.admin`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Platform administration (/admin); Platform administration (/admin/users/[id]); Platform administration (/admin/feedback). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/admin`.

### Account and workspace settings

- Identifier: `core.settings`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Account and workspace settings (/settings). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/settings`.

### In-product guide

- Identifier: `core.guide`.
- Conditions: Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.
- Frontend surfaces: Product guide (/guide). See the frontend/persona matrix for actions.
- Evidence: `docs/architecture/web/feature-map.generated.md`, `docs/design/persona-workflow.md`, `apps/web/src/features/guide`.

### SaaS public landing pages

- Identifier: `platform.public-landing`.
- Conditions: SaaS web build only. The API public-site capability remains unimplemented.
- Frontend surfaces: Public landing (/). See the frontend/persona matrix for actions.
- Evidence: `apps/web/src/app/page.tsx`, `apps/web/src/features/public-site/landing/views/landing-view.tsx`.

### Single-server AlphaCI appliance

- Identifier: `runtime.selfhost-appliance`.
- Conditions: Deployment option independent of edition; supplied appliance images use Enterprise. Not an air-gap claim.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `deploy/selfhost/compose.yaml`, `deploy/selfhost/alphaci-ctl`.

### School organization and staff setup

- Identifier: `EDU-01`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Courses, classes, rosters, join-code enrollment

- Identifier: `EDU-02`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Teacher assignment creation and group editing

- Identifier: `EDU-03`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Student repository submission, CI pipeline and hidden tests

- Identifier: `EDU-04`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Live lab sessions and lab machine operations

- Identifier: `EDU-05`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Scheduled class/lab availability and lab extension delivery

- Identifier: `EDU-06`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Student, teacher, school admin and platform admin portals

- Identifier: `EDU-07`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### LMS/LTI linkage

- Identifier: `EDU-08`.
- Conditions: No current pack grant. Historical origin is EDU; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Contract-entitled billing replacing payment checkout

- Identifier: `SAAS-01`.
- Conditions: No current pack grant. Historical origin is SaaS; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

### Email/OAuth self-serve account creation and sign-in

- Identifier: `SAAS-02`.
- Conditions: No current pack grant. Historical origin is SaaS; see cited refs before any port or assignment.
- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.
- Evidence: `docs/plans/golden-copy-persona-map/legacy-reconciliation.md`.

## Refresh

Run `node docs/plans/golden-copy-persona-map/build-product-map.cjs`. The script validates catalog coverage and evidence paths, then rebuilds this snapshot and its HTML from the same data. Narrative shared-area descriptions require review when journeys change.

Current contracts remain in [capabilities](../../capabilities/index.md) and [packs](../../packs/pack-contract.md). Historical refs are in [legacy reconciliation](legacy-reconciliation.md). Proposed commercial assignments are separate in the [proposal](../2026-11-05-feature-composition-improvements.md).
