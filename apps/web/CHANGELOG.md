# Changelog

## [Unreleased]

### Added

- Added the Teams project explorer: the team rail's Repositories entry becomes **Projects (n)**, listing each team Project (hierarchy delivery project) with its repositories as role chips (Frontend / Backend / Service / App) that open their dashboards, a checklist count, and an Unfiled group. Opening a Project shows its repositories, "Verify in QA Studio" (the frontend repository, else an app; QA Team, Team lead and Admin), "Create repository in this Project", per-repository "Move to another Project" (409 "moved by someone else" refetches; an emptied Project can be archived), and attach/detach of checklist templates through `PATCH /qa-checklists/:id/projects` so shares outside the Project are never touched. Leads get "New Project". The Workflows studio's Current Projects pane shows the same explorer. The team QA checklists section is relabelled **Checklist templates**.
- The Create Project wizard now honours `?group=` (preselects the team) and `?project=` (sends `deliveryProjectId` and shows "Project: team / project"); malformed or foreign ids are ignored.

- Added QA Studio: a project tab in the Delivery group that frames a deployed branch (Desktop / Tablet 768 / Mobile 375, same-host route field, reload, open in new tab) beside a verification run of a shared checklist against the commit the server resolves. Testers record each item's status, notes, severity and reproduction steps (severity required for Failed and Returned to dev), sign runs off as Approved / Conditional / Rejected with the eligibility reasons shown, and leads can reopen a signed-off run. Every right comes from the server (`item.canUpdate`, run `permissions`); stale writes (409) offer "Reload run". The project Overview gains a "Returned by QA" card where Developers, Team leads and Admins mark an item fixed and request a re-test. Both are gated by `qaChecklistsEnabled`.

- Added shared QA checklists: team leads write ordered checklists at team (workspace) scope in a new Teams → QA checklists section, edit items (who runs it, how it is verified, test identifier), share them to the team's projects, and archive them; QA Team and Developers get the same screens read-only. Projects gain a Checklists tab in the Work group. Both are gated by the `projects.qa-checklists` capability (`qaChecklistsEnabled`).

- Added the real Enterprise client-composition settings surface, gated by the backend-owned capability/configuration projection and backed by the package-owned artifact symbol `EnterpriseClientCompositionSettingsView`.
- Added frontend profile tests proving hosted/EDU output aliases the excluded barrel to a fail-closed named stub and does not contain the Enterprise implementation symbol.
- Added backend-owned capability package provenance, a checked-in expected release record, canonical artifact-digest verification, and focused tamper tests for the vendored fixture.
- Added the local `@alphaci/capability-catalog` release fixture, profile resolver, package drift gate, and build-profile checks for frontend exclusion.
- Added an OKF v0.2 current-state documentation bundle covering architecture, capabilities, composition packs, runbooks, and change history.
- Added a shared catalog snapshot and surface map so SaaS, EDU, and Enterprise pack profiles stay comparable with the backend Golden Copy.
- Added repository checks for OKF structure, lower-kebab documentation names, stale claims, edition branches, generated-map drift, and catalog snapshot matching.
- Added an executive Golden Copy report covering Enterprise-first priorities, parallel implementation workstreams, delivery gates, and evidence requirements.
- Added ADR-0004, recording build profile exclusion and the published capability catalog dependency.
- Added ADR-0005, recording that capability surface data is consumed from the versioned package and is not frontend-owned.

### Changed

- Repository tabs follow the viewer's role (an allow-list per role): a Product owner (`lead`) gets only Overview, Checklists, QA Studio, Audit and Settings; a Developer gets Environment as well as Hosting; QA Team and Admins are unchanged. A deep link to a hidden tab lands on Overview. Hosting, custom domain, deployment-secret and environment/repository variable writes are for Developers and admins (Product owners lose them, as on the backend); the `ENV_VARS_LEAD_ONLY` / `HOSTING_LEAD_ONLY` refusals read "Developers and admins can change ...".
- The repository Overview is the same lean page for everyone: branch previews, a compact **My QA items** summary (a count per state — Returned, In progress, To do, Ready for QA — and **Open checklist**, to the Project's My QA items or this repository's Checklists tab, which now carries the full list), the Developer's production readiness card, and the failure reason. The facts grid, Manage access, local snapshot, health checks and drift findings are gone, with their Overview reads.
- The Audit tab is readable: each event in words (with the server's message as a fallback), its actor or "System", a relative time with the exact time on hover, a "Project" tag for Project-scoped events, and **Load more** over `GET /projects/:id/audit?limit=50&before=<next>`. It says when audit recording is turned off.
- The team Activity feed is hidden (`SIDEBAR_SHOWS_ACTIVITY = false`): no sidebar entry and no Home Activity rail. `/activity` and `/groups/:id/activity` still work.
- Restructured team navigation around the header's workspace picker, the only team selector. The Projects page (`/workflows`) lost its team dropdown and its team rail: it shows the header team's Project cards (no per-repository chips) under a plain "Projects" heading, with one primary **Create project** and a "⋯" menu holding **Empty project** and **Add repository** (WAI-ARIA menu button). The team's other sections are pages of their own: **Teams** (`/teams`) is the members page, and the sidebar gains **Checklists** (`/checklists`, with the QA checklists capability) and **Activity** (`/activity`); team settings moved to a lead/admin-only **Team** tab on `/settings`. The Overview section is gone. Platform admins see teams they are not a member of in the header picker under "Other teams (admin)". Old `/teams?section=…` links are forwarded, and "Manage project" / checklist manage links point at the new pages. The Settings page's workspace members list is read-only with a link to Teams; the frontend no longer calls the `/workspaces/:id/members` write routes.
- Updated the local catalog fixture to `@alphaci/capability-catalog@0.2.0`, including typed capability surface data.
- Regenerated the capability snapshot and OKF surface view from the vendored package; frontend checks now fail on surface drift.
- Changed capability and pack documentation checks to use the versioned package contract instead of a sibling backend checkout. Package publication remains outside this local change.
- Consolidated the root README and feature/shared notes so architecture and product status live in the documentation bundle.
- Made ADR-0003's rejected alternative precise, separating rejected pack duplication from permitted build-time exclusion.
