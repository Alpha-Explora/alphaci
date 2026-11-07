# Frontend screens, personas and actions

Investigation snapshot: November 5, 2026. Generated from the route inventory and executed pure UI/backend policy functions, with reviewed screen descriptions. This is a source map, not a claim of live browser verification.

All personas still require pack availability, authentication, resource access and workflow preconditions. Internal inherits its base pack and normal persona. Global app role, group manager rights and platform-admin authorization are separate.

Covers 28 pages, 12 project tabs, nine action groups and one read-only Enterprise card.

## Overview tab

- Surface: `/projects/[projectId]#overview`
- Feature owner: core.projects
- Packs: SaaS, EDU, Enterprise
- Contains: Project summary, returned QA work and Developer read-only production readiness.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible. Actions follow the separate action rows. |
| QA | Visible. Actions follow the separate action rows. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Code tab

- Surface: `/projects/[projectId]#code`
- Feature owner: core.repositories
- Packs: SaaS, EDU, Enterprise
- Contains: File browser and branches; branch creation for allowed roles.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hidden tab; a deep link resolves to a permitted tab. |
| QA | Hidden tab; a deep link resolves to a permitted tab. |
| Developer | Visible. Create branch from dev when server permits. |
| Admin | Visible. Create branch from dev when server permits. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Commits tab

- Surface: `/projects/[projectId]#commits`
- Feature owner: core.repositories
- Packs: SaaS, EDU, Enterprise
- Contains: Read commits and branches; listing visibility differs by role.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hidden tab; a deep link resolves to a permitted tab. |
| QA | Hidden tab; a deep link resolves to a permitted tab. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Pull requests tab

- Surface: `/projects/[projectId]#pulls`
- Feature owner: core.repositories
- Packs: SaaS, EDU, Enterprise
- Contains: Compare branches, open and merge permitted routes; generic production merge forbidden.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hidden tab; a deep link resolves to a permitted tab. |
| QA | Hidden tab; a deep link resolves to a permitted tab. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Requirements / Checklists tab

- Surface: `/projects/[projectId]#checklists`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Features, stories, system requirements, Progress, test cases and QA workspace.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible. Actions follow the separate action rows. |
| QA | Visible. Actions follow the separate action rows. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Tab requires QA checklists enabled. Governance gates acceptance/merge writes separately, not the whole PO tab.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Pipeline tab

- Surface: `/projects/[projectId]#pipeline`
- Feature owner: pipelines.ci-run-tracking
- Packs: SaaS, EDU, Enterprise
- Contains: Runs and Configuration views; preview/validate settings and request workflow PR where permitted.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hidden tab; a deep link resolves to a permitted tab. |
| QA | Hidden tab; a deep link resolves to a permitted tab. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Hosting tab

- Surface: `/projects/[projectId]#hosting`
- Feature owner: runtime.env-provisioning
- Packs: SaaS, EDU, Enterprise
- Contains: Environment cards, provider targets, variables, domains, promotion and host assignments.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hidden tab; a deep link resolves to a permitted tab. |
| QA | Hidden tab; a deep link resolves to a permitted tab. |
| Developer | Visible. Developer/admin manage hosting and variables; other release actions remain separately checked. |
| Admin | Visible. Developer/admin manage hosting and variables; other release actions remain separately checked. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## QA Studio tab

- Surface: `/projects/[projectId]#qa`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: UAT preview, test results, defects, evidence, automation and sign-off.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hidden tab; a deep link resolves to a permitted tab. |
| QA | Visible. QA controls follow returned run permissions and workflow state. |
| Developer | Hidden tab; a deep link resolves to a permitted tab. |
| Admin | Visible. QA controls follow returned run permissions and workflow state. |

- Conditions / hidden or disabled behavior: Tab requires QA checklists enabled. Governance gates acceptance/merge writes separately, not the whole PO tab.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## PO Studio tab

- Surface: `/projects/[projectId]#po`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: UAT acceptance, production readiness and governed merge controls.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible. Acceptance/merge actions require governance and server permission. |
| QA | Hidden tab; a deep link resolves to a permitted tab. |
| Developer | Hidden tab; a deep link resolves to a permitted tab. |
| Admin | Visible. Acceptance/merge actions require governance and server permission. |

- Conditions / hidden or disabled behavior: Tab requires QA checklists enabled. Governance gates acceptance/merge writes separately, not the whole PO tab.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Audit tab

- Surface: `/projects/[projectId]#audit`
- Feature owner: platform.audit-events
- Packs: SaaS, EDU, Enterprise
- Contains: Read project audit trail.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible. Actions follow the separate action rows. |
| QA | Visible. Actions follow the separate action rows. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## History tab

- Surface: `/projects/[projectId]#history`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Iteration and release history; read-only history does not grant delivery actions.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible. Actions follow the separate action rows. |
| QA | Visible. Actions follow the separate action rows. |
| Developer | Visible. Actions follow the separate action rows. |
| Admin | Visible. Actions follow the separate action rows. |

- Conditions / hidden or disabled behavior: Tab requires QA checklists enabled. Governance gates acceptance/merge writes separately, not the whole PO tab.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Project settings tab

- Surface: `/projects/[projectId]#settings`
- Feature owner: core.projects
- Packs: SaaS, EDU, Enterprise
- Contains: Project settings and lifecycle controls, subject to individual action permissions.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible. Lifecycle controls allowed subject to checks. |
| QA | Visible. Lifecycle controls hidden. |
| Developer | Visible. Lifecycle controls hidden. |
| Admin | Visible. Lifecycle controls allowed subject to checks. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Create/edit requirements

- Surface: `/projects/[projectId]#checklists`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Create/edit requirements

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Editable: create/edit Features, User stories and system requirements. |
| QA | Read-only requirements; authoring controls unavailable. |
| Developer | Read-only requirements; authoring controls unavailable. |
| Admin | Editable: create/edit Features, User stories and system requirements. |

- Conditions / hidden or disabled behavior: Current iteration and project rights; server returned permissions remain authoritative.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/api/src/kernel/rules/persona-access.rules.ts`

## Developer Progress / request retest

- Surface: `/projects/[projectId]#checklists`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Developer Progress / request retest

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Set Progress / request retest when item permits. |
| QA | No Progress write; QA verifies instead. |
| Developer | Set Progress / request retest when item permits. |
| Admin | Set Progress / request retest when item permits. |

- Conditions / hidden or disabled behavior: Item ownership/scope, row version and workflow state.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`

## Author test cases and record test results

- Surface: `/projects/[projectId]#checklists`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Author test cases and record test results

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Read-only test cases/results. |
| QA | Editable test cases/results in the permitted QA surface. |
| Developer | Read-only test cases/results. |
| Admin | Editable test cases/results in the permitted QA surface. |

- Conditions / hidden or disabled behavior: QA/admin; current run and test-case permissions.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`

## Verification, evidence, automation and sign-off

- Surface: `/projects/[projectId]#qa`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Verification, evidence, automation and sign-off

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | QA Studio hidden; see backend distinction in details. |
| QA | QA Studio visible; controls enabled only when run permits. |
| Developer | QA Studio hidden; see backend distinction in details. |
| Admin | QA Studio visible; controls enabled only when run permits. |

- Conditions / hidden or disabled behavior: UAT head freshness, active run, evidence, version checks and sign-off preconditions.
- Backend authorization: Backend allows qa/lead/admin for create run, verification, automation, evidence and sign-off. Frontend QA Studio is qa/admin only; these are distinct rules.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`, `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`

## Accept QA items / merge to production

- Surface: `/projects/[projectId]#po`
- Feature owner: projects.release-governance
- Packs: SaaS, EDU, Enterprise
- Contains: Accept QA items / merge to production

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | PO acceptance and governed merge offered; disabled/blocked until checks pass. |
| QA | Acceptance and governed production merge unavailable. |
| Developer | Acceptance and governed production merge unavailable. |
| Admin | PO acceptance and governed merge offered; disabled/blocked until checks pass. |

- Conditions / hidden or disabled behavior: Governance and QA enabled; latest approved QA run, accepted items and unchanged UAT heads; generic PR merge to main is forbidden for every role.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`, `apps/web/src/features/checklists/studio/view-models/use-po-acceptance-view-model.ts`, `apps/web/src/features/checklists/studio/view-models/use-qa-promotion-view-model.ts`

## Start next iteration

- Surface: `/projects/[projectId]#checklists`
- Feature owner: projects.release-governance
- Packs: SaaS, EDU, Enterprise
- Contains: Start next iteration

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Start next iteration offered when prior iteration delivered. |
| QA | Start control unavailable; waiting/read-only state. |
| Developer | Start control unavailable; waiting/read-only state. |
| Admin | Start next iteration offered when prior iteration delivered. |

- Conditions / hidden or disabled behavior: Governance enabled, prior iteration delivered and current server preconditions.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/checklists/iteration/view-models/use-start-iteration-view-model.ts`, `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`

## Manage hosting, variables, domains and CI secrets

- Surface: `/projects/[projectId]#hosting`
- Feature owner: runtime.env-provisioning
- Packs: SaaS, EDU, Enterprise
- Contains: Manage hosting, variables, domains and CI secrets

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hosting mutation controls hidden; Hosting tab itself is hidden for Product owner/QA. |
| QA | Hosting mutation controls hidden; Hosting tab itself is hidden for Product owner/QA. |
| Developer | Hosting controls and Variables column available when provider/config permits. |
| Admin | Hosting controls and Variables column available when provider/config permits. |

- Conditions / hidden or disabled behavior: Provisioning enabled; provider credentials, resource access and separate host-delivery capability where relevant.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/api/src/kernel/rules/persona-access.rules.ts`, `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Promote an environment release

- Surface: `/projects/[projectId]#hosting`
- Feature owner: runtime.env-provisioning
- Packs: SaaS, EDU, Enterprise
- Contains: Promote an environment release

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Hosting tab hidden; API rights do not automatically create a frontend control. |
| QA | Hosting tab hidden; API rights do not automatically create a frontend control. |
| Developer | Hosting surface visible; Developer can promote non-production only; admin may promote production subject to checks. |
| Admin | Hosting surface visible; Developer can promote non-production only; admin may promote production subject to checks. |

- Conditions / hidden or disabled behavior: Ordered environments, pinned signed release, destination readiness; managed-host capability for host delivery.
- Backend authorization: Backend canPromoteRelease: lead/admin may promote production or non-production; member only non-production; QA neither. Frontend Hosting tab is member/admin only. This is separate from governed uat-to-main code merge.
- Evidence: `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`, `apps/api/src/modules/runtime/domain/release-access.rules.ts`

## Create/merge repository pull requests

- Surface: `/projects/[projectId]#pulls`
- Feature owner: core.repositories
- Packs: SaaS, EDU, Enterprise
- Contains: Create/merge repository pull requests

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Pull requests tab hidden for Product owner/QA. |
| QA | Pull requests tab hidden for Product owner/QA. |
| Developer | Developer: feature→dev or dev→uat. Admin: any permitted non-main route. |
| Admin | Developer: feature→dev or dev→uat. Admin: any permitted non-main route. |

- Conditions / hidden or disabled behavior: No role may create/merge main through generic endpoints; production uses governed promotion.
- Backend authorization: Backend also allows lead on non-production PR routes, although the Product owner frontend hides this tab. QA is denied.
- Evidence: `apps/api/src/kernel/rules/persona-access.rules.ts`, `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Public landing

- Surface: `/`
- Feature owner: platform.public-landing
- Related capability controls on this page: platform.public-site. Individual controls can be narrower than page access.
- Packs: SaaS
- Contains: SaaS marketing landing; other editions redirect to login.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Public: no persona required. |
| QA | Public: no persona required. |
| Developer | Public: no persona required. |
| Admin | Public: no persona required. |

- Conditions / hidden or disabled behavior: SaaS web build only; not the unimplemented public-site API capability.
- Backend authorization: No persona is required to reach this entry route. It grants no privileged access to protected APIs.
- Evidence: `apps/web/src/app/page.tsx`

## Sign-in and callback

- Surface: `/login`
- Feature owner: core.auth
- Packs: SaaS, EDU, Enterprise
- Contains: Authentication entry, callback and session handoff.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Authentication flow; resulting session determines persona. |
| QA | Authentication flow; resulting session determines persona. |
| Developer | Authentication flow; resulting session determines persona. |
| Admin | Authentication flow; resulting session determines persona. |

- Conditions / hidden or disabled behavior: Public route or authentication handshake; protected operations still require a valid session and authorization.
- Backend authorization: No persona is required to reach this entry route. It grants no privileged access to protected APIs.
- Evidence: `apps/web/src/app/(access)/login/page.tsx`

## Sign-in and callback

- Surface: `/auth/callback`
- Feature owner: core.auth
- Packs: SaaS, EDU, Enterprise
- Contains: Authentication entry, callback and session handoff.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Authentication flow; resulting session determines persona. |
| QA | Authentication flow; resulting session determines persona. |
| Developer | Authentication flow; resulting session determines persona. |
| Admin | Authentication flow; resulting session determines persona. |

- Conditions / hidden or disabled behavior: Public route or authentication handshake; protected operations still require a valid session and authorization.
- Backend authorization: No persona is required to reach this entry route. It grants no privileged access to protected APIs.
- Evidence: `apps/web/src/app/(access)/auth/callback/page.tsx`

## Sign-up redirect

- Surface: `/signup`
- Feature owner: core.auth
- Packs: SaaS, EDU, Enterprise
- Contains: Redirects to /login; no self-serve account creation form.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Redirect to login. |
| QA | Redirect to login. |
| Developer | Redirect to login. |
| Admin | Redirect to login. |

- Conditions / hidden or disabled behavior: Public route or authentication handshake; protected operations still require a valid session and authorization.
- Backend authorization: No persona is required to reach this entry route. It grants no privileged access to protected APIs.
- Evidence: `apps/web/src/app/(access)/signup/page.tsx`

## Product guide

- Surface: `/guide`
- Feature owner: core.guide
- Related capability controls on this page: platform.public-site. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Guide and product help.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Public guide; no privileged action grant. |
| QA | Public guide; no privileged action grant. |
| Developer | Public guide; no privileged action grant. |
| Admin | Public guide; no privileged action grant. |

- Conditions / hidden or disabled behavior: Public route or authentication handshake; protected operations still require a valid session and authorization.
- Backend authorization: No persona is required to reach this entry route. It grants no privileged access to protected APIs.
- Evidence: `apps/web/src/app/(public)/guide/page.tsx`

## Home dashboard

- Surface: `/home`
- Feature owner: core.home
- Packs: SaaS, EDU, Enterprise
- Contains: Role-aware summaries, projects and work navigation.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/home/page.tsx`

## Notification inbox

- Surface: `/inbox`
- Feature owner: platform.notifications
- Related capability controls on this page: platform.notifications. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Read own notifications and change own notification state/preferences.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: own recipient-scoped inbox. |
| QA | Visible: own recipient-scoped inbox. |
| Developer | Visible: own recipient-scoped inbox. |
| Admin | Visible: own recipient-scoped inbox. |

- Conditions / hidden or disabled behavior: Notifications capability; never another user’s inbox.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/inbox/page.tsx`

## CI runs

- Surface: `/runs`
- Feature owner: pipelines.ci-run-tracking
- Related capability controls on this page: pipelines.ci-run-tracking. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: CI run list, status and run detail links.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/runs/page.tsx`

## CI run report

- Surface: `/runs/report`
- Feature owner: pipelines.ci-run-tracking
- Packs: SaaS, EDU, Enterprise
- Contains: Read the CI run report from /ci/runs/report; distinct from a QA verification report.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: CI run tracking and permitted run/repository access; this is not gated by the QA-checklist report contract.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/runs/report/page.tsx`

## QA report

- Surface: `/projects/[projectId]/qa/report/[runId]`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Read permitted QA report; report availability and server authorization apply.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: QA capability and run/project visibility. A report URL is not permission to edit a run.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/projects/[projectId]/qa/report/[runId]/page.tsx`

## QA report

- Surface: `/qa/project-report/[deliveryProjectId]/[runId]`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Read permitted QA report; report availability and server authorization apply.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: QA capability and run/project visibility. A report URL is not permission to edit a run.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/qa/project-report/[deliveryProjectId]/[runId]/page.tsx`

## Project detail

- Surface: `/projects/[projectId]`
- Feature owner: core.projects
- Related capability controls on this page: runtime.env-provisioning, runtime.managed-host-delivery, runtime.gcp-deployments, runtime.deployment-history, runtime.preview-deployments, runtime.drift-detection, runtime.drift-repair, projects.sync-snapshots, projects.workflow-settings-preview, projects.workflow-update-pr, projects.target-management, projects.qa-checklists, projects.release-governance, pipelines.ci-run-tracking. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Overview, repository work, requirements, QA/PO studios, hosting, audit, history and settings; tabs differ by persona.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible tabs: overview, checklists, po, audit, history, settings. |
| QA | Visible tabs: overview, checklists, qa, audit, history, settings. |
| Developer | Visible tabs: overview, code, commits, pulls, checklists, pipeline, hosting, audit, history, settings. |
| Admin | Visible tabs: overview, code, commits, pulls, checklists, pipeline, hosting, qa, po, audit, history, settings. |

- Conditions / hidden or disabled behavior: Tab availability below assumes QA enabled; disabling it removes Checklists, QA, PO and History.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/projects/[projectId]/page.tsx`, `apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts`

## Create repository / workflow studio

- Surface: `/workflows`
- Feature owner: core.workflow-studio
- Related capability controls on this page: runtime.env-provisioning, runtime.managed-host-delivery, runtime.gcp-deployments. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Create or onboard repositories and configure workflows.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Repository creation denied; route presence does not grant it. |
| QA | Repository creation denied; route presence does not grant it. |
| Developer | Create/onboard repository; Developer requires an existing Project with an active Feature. |
| Admin | Create/onboard repository; Developer requires an existing Project with an active Feature. |

- Conditions / hidden or disabled behavior: Capabilities, provider setup and repository permissions apply; admin is exempt from the existing Project/Feature requirement.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/workflows/page.tsx`, `apps/api/src/kernel/rules/persona-access.rules.ts`

## Team / group

- Surface: `/teams`
- Feature owner: identity.hierarchy
- Related capability controls on this page: identity.hierarchy, projects.qa-checklists. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Projects explorer, member links, checklist templates, activity and settings.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | View team; manage where group response grants manager rights; create Project as permitted. |
| QA | View permitted team; management follows returned group rights. |
| Developer | View permitted team; management follows returned group rights. |
| Admin | View team; manage where group response grants manager rights; create Project as permitted. |

- Conditions / hidden or disabled behavior: Workspace/group membership and manager permissions. Global persona alone does not establish group manager rights.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/teams/page.tsx`, `apps/api/src/kernel/rules/persona-access.rules.ts`

## Team / group

- Surface: `/groups/[groupId]`
- Feature owner: identity.hierarchy
- Related capability controls on this page: identity.hierarchy. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Projects explorer, member links, checklist templates, activity and settings.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | View team; manage where group response grants manager rights; create Project as permitted. |
| QA | View permitted team; management follows returned group rights. |
| Developer | View permitted team; management follows returned group rights. |
| Admin | View team; manage where group response grants manager rights; create Project as permitted. |

- Conditions / hidden or disabled behavior: Workspace/group membership and manager permissions. Global persona alone does not establish group manager rights.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/page.tsx`, `apps/api/src/kernel/rules/persona-access.rules.ts`

## Team members

- Surface: `/groups/[groupId]/members`
- Feature owner: identity.hierarchy
- Packs: SaaS, EDU, Enterprise
- Contains: Member list; add/remove controls for group managers.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | View permitted members; add/remove only if returned group role is a manager. |
| QA | View permitted members; add/remove only if returned group role is a manager. |
| Developer | View permitted members; add/remove only if returned group role is a manager. |
| Admin | View permitted members; add/remove only if returned group role is a manager. |

- Conditions / hidden or disabled behavior: UI uses isGroupManagerRole(group.role); server enforces group management.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/members/page.tsx`, `apps/web/src/features/groups/members/view-models/use-group-members-view-model.ts`

## Systems

- Surface: `/groups/[groupId]/systems`
- Feature owner: identity.hierarchy
- Packs: SaaS, EDU, Enterprise
- Contains: Group systems, their projects and repository organization.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: Group scope; mutation controls depend on returned management permissions.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/systems/page.tsx`

## Systems

- Surface: `/groups/[groupId]/systems/[systemId]`
- Feature owner: identity.hierarchy
- Packs: SaaS, EDU, Enterprise
- Contains: Group systems, their projects and repository organization.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: Group scope; mutation controls depend on returned management permissions.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/systems/[systemId]/page.tsx`

## Project requirements workspace

- Surface: `/groups/[groupId]/delivery-projects/[deliveryProjectId]`
- Feature owner: core.projects
- Packs: SaaS, EDU, Enterprise
- Contains: Project repositories, requirements, QA and create-repository entry.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | View; manage requirements; no create-repository control. |
| QA | View; QA/test actions as permitted; no repository creation. |
| Developer | View; add repository when project/Feature conditions pass; role-specific QA actions below. |
| Admin | View; add repository when project/Feature conditions pass; role-specific QA actions below. |

- Conditions / hidden or disabled behavior: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/delivery-projects/[deliveryProjectId]/page.tsx`, `apps/web/src/features/groups/delivery-project/view-models/use-delivery-project-view-model.ts`

## Group repository

- Surface: `/groups/[groupId]/repositories/[repositoryId]`
- Feature owner: core.repositories
- Packs: SaaS, EDU, Enterprise
- Contains: Repository details within the group scope.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: Group/repository access; project work uses the detailed tab rules.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/repositories/[repositoryId]/page.tsx`

## Team activity

- Surface: `/activity`
- Feature owner: identity.hierarchy
- Packs: SaaS, EDU, Enterprise
- Contains: Team activity feed; sidebar and Home activity entry are currently hidden.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Direct route: team member Product owner may read. |
| QA | Hidden in sidebar; feed denied for QA. |
| Developer | Hidden in sidebar; feed denied for Developer. |
| Admin | Direct route: platform admin may read permitted team feed. |

- Conditions / hidden or disabled behavior: SIDEBAR_SHOWS_ACTIVITY=false. A hidden navigation entry does not remove the route.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/activity/page.tsx`, `apps/web/src/features/workspace/selection/model/workspace-types.ts`

## Team activity

- Surface: `/groups/[groupId]/activity`
- Feature owner: identity.hierarchy
- Packs: SaaS, EDU, Enterprise
- Contains: Team activity feed; sidebar and Home activity entry are currently hidden.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Direct route: team member Product owner may read. |
| QA | Hidden in sidebar; feed denied for QA. |
| Developer | Hidden in sidebar; feed denied for Developer. |
| Admin | Direct route: platform admin may read permitted team feed. |

- Conditions / hidden or disabled behavior: SIDEBAR_SHOWS_ACTIVITY=false. A hidden navigation entry does not remove the route.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/groups/[groupId]/activity/page.tsx`, `apps/web/src/features/workspace/selection/model/workspace-types.ts`

## Legacy team checklists

- Surface: `/checklists`
- Feature owner: projects.qa-checklists
- Packs: SaaS, EDU, Enterprise
- Contains: Earlier team checklist templates; project requirements live on the Project.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Visible: read permitted resources. |
| QA | Visible: read permitted resources. |
| Developer | Visible: read permitted resources. |
| Admin | Visible: read permitted resources. |

- Conditions / hidden or disabled behavior: SIDEBAR_SHOWS_CHECKLISTS=false; route remains. Editing follows returned checklist/team permissions.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/checklists/page.tsx`, `apps/web/src/features/workspace/selection/model/workspace-types.ts`

## Managed host inventory

- Surface: `/hosts`
- Feature owner: runtime.managed-host-delivery
- Related capability controls on this page: runtime.env-provisioning, runtime.managed-host-delivery. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Machines, enrollment code/installer, connection status and host controls.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | View hosts; add/manage controls hidden. |
| QA | View hosts; add/manage controls hidden. |
| Developer | View; add/manage only with non-viewer workspace membership. |
| Admin | View; add/manage only with non-viewer workspace membership. |

- Conditions / hidden or disabled behavior: Requires managed-host capability, provider availability and workspace access; disabled composition shows unavailable state.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/hosts/page.tsx`, `apps/web/src/features/hosts/model/host-types.ts`, `apps/web/src/features/hosts/views/hosts-page.tsx`

## Account and workspace settings

- Surface: `/settings`
- Feature owner: core.settings
- Related capability controls on this page: identity.workspaces, platform.notifications, runtime.client-composition. Individual controls can be narrower than page access.
- Packs: SaaS, EDU, Enterprise
- Contains: Account/preferences and read-only workspace member list; Enterprise policy summary where enabled.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Own settings; workspace member list is read-only. Team membership edits live on Teams. |
| QA | Own settings; workspace member list is read-only. Team membership edits live on Teams. |
| Developer | Own settings; workspace member list is read-only. Team membership edits live on Teams. |
| Admin | Own settings; workspace member list is read-only. Team membership edits live on Teams. |

- Conditions / hidden or disabled behavior: Client policy card is Enterprise-only and read-only; ordinary account settings are shared.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/settings/page.tsx`, `apps/web/src/features/settings/account/view-models/use-workspace-members-view-model.ts`

## Platform administration

- Surface: `/admin`
- Feature owner: core.admin
- Packs: SaaS, EDU, Enterprise
- Contains: User review, user detail and feedback administration.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Privileged admin surface; Product owner role alone is insufficient. |
| QA | Privileged admin surface; QA role alone is insufficient. |
| Developer | Privileged admin surface; Developer role alone is insufficient. |
| Admin | Admin controls require platform-admin authorization, not just a client-selected role. |

- Conditions / hidden or disabled behavior: Platform-admin authorization is independent of pack and workspace role.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/admin/page.tsx`

## Platform administration

- Surface: `/admin/users/[id]`
- Feature owner: core.admin
- Packs: SaaS, EDU, Enterprise
- Contains: User review, user detail and feedback administration.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Privileged admin surface; Product owner role alone is insufficient. |
| QA | Privileged admin surface; QA role alone is insufficient. |
| Developer | Privileged admin surface; Developer role alone is insufficient. |
| Admin | Admin controls require platform-admin authorization, not just a client-selected role. |

- Conditions / hidden or disabled behavior: Platform-admin authorization is independent of pack and workspace role.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/admin/users/[id]/page.tsx`

## Platform administration

- Surface: `/admin/feedback`
- Feature owner: core.admin
- Packs: SaaS, EDU, Enterprise
- Contains: User review, user detail and feedback administration.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Privileged admin surface; Product owner role alone is insufficient. |
| QA | Privileged admin surface; QA role alone is insufficient. |
| Developer | Privileged admin surface; Developer role alone is insufficient. |
| Admin | Admin controls require platform-admin authorization, not just a client-selected role. |

- Conditions / hidden or disabled behavior: Platform-admin authorization is independent of pack and workspace role.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/app/(platform)/admin/feedback/page.tsx`

## Enterprise client-policy summary

- Surface: `/settings`
- Feature owner: runtime.client-composition
- Packs: Enterprise
- Contains: Deployment client, edition and excluded capability list; read-only summary.

| Persona | Frontend visibility and actions |
|---|---|
| Product owner | Read-only where capability response supplies the card; no policy editor. |
| QA | Read-only where capability response supplies the card; no policy editor. |
| Developer | Read-only where capability response supplies the card; no policy editor. |
| Admin | Read-only where capability response supplies the card; no policy editor. |

- Conditions / hidden or disabled behavior: Enterprise + active client composition. Changing policy requires deployment configuration and restart.
- Backend authorization: Pack availability, authentication, resource membership and server-returned action permissions still apply.
- Evidence: `apps/web/src/features/settings/client-composition/views/enterprise-client-composition-settings-view.tsx`

Refresh with `node docs/plans/golden-copy-persona-map/build-product-map.cjs`. [Full feature contents and packs](product-feature-map.md).
