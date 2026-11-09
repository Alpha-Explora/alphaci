# Changelog

Notable changes to AlphaCI, both images. One line per change, written for the people who run and use AlphaCI; the pull request holds the detail.

## [Unreleased]

### Added

- **Composition:** Independent governance and managed-host controls preserve existing edition access; `alphaci-ctl composition` explains local capability availability and exclusions.
- **Capabilities:** Contributors can preview new assignments without writes; a generated feature inventory links built behavior to existing capabilities, authorization code, and evidence.
- **Self-hosted:** AlphaCI runs on one server as a Docker Compose appliance (Caddy, API, web, migrator, Postgres 16), managed with `alphaci-ctl init | admin-grant | doctor`.
- **Self-hosted:** Runs without Supabase: `ALPHACI_DEPLOYMENT_MODE=selfhosted`, `DATABASE_URL`, Postgres sessions, and QA screenshots stored in Postgres.
- **Self-hosted:** `npm run db:migrate:selfhost` applies migrations with a ledger and refuses to run when an applied migration changed.
- **Self-hosted:** `ALPHACI_RELEASE_SIGNER=file` signs releases with a key held on the server, so no signing secret reaches GitHub.
- **Self-hosted:** One web image serves every customer, built with `NEXT_PUBLIC_API_BASE_URL=/api/v1`, with a `/healthz` liveness route.
- **Self-hosted:** `ALPHACI_BIND_ADDRESS` limits the appliance proxy to one IPv4 address.
- **Self-hosted:** App addresses can sit under a shared domain (`ONPREM_APPS_LABEL_SUFFIX`); `ALPHACI_TLS_DIRECTIVE=internal` gives app sites Caddy's private CA.
- **On-prem:** Serve an environment under your own hostname, listen address and uploaded .pfx or automatic certificate, like an IIS binding (agent 0.5.0).
- **On-prem:** A Hosts page to enroll machines, see their status, and assign them to environments with ports, health path and ingress.
- **On-prem:** Signed releases, promotion and rollback on customer machines, with per-environment workers and readiness checks.
- **On-prem:** Both halves of a two-repository project on one machine share a network and each other's address (agent 0.4.0 or newer).
- **On-prem:** Container ports and health paths default to the scaffolded app's own, such as .NET on 8080 with `/health`.
- **Projects:** Ordered, renameable environments per project, each with its own targets, and promotion of a release from one environment to the next.
- **Projects:** Two-repository projects get per-environment pipelines and on-prem hosting.
- **Projects:** A Projects explorer with a Members action; Developers add repositories once the Product owner has written a Feature.
- **Teams:** Add member can also add the person to the team's Projects, so a Developer gets GitHub write access to those Projects' repositories in the same step.
- **Hosting:** Roll back a Render or Vercel deployment from ALPHACI, with the reason recorded in the Audit trail.
- **Hosting:** Live deployment logs with filters and a live tail; Vercel deploy history includes production.
- **Hosting:** Render deploys show their commit, trigger and duration, and a deploy a newer one replaced reads "Replaced".
- **QA:** Project requirements: Features with User stories and system requirements; Developers report Progress and QA verifies once per Project.
- **QA:** QA Studio verifies a deployed branch beside a checklist, with results, severity and sign-off; checklists are shared across a team's projects.
- **QA:** Test cases under each User story; a story cannot pass while one of its test cases is open.
- **QA:** Evidence screenshots on run items (capture, paste or upload), also in the printable report.
- **Iterations:** Merging to main delivers the iteration (Merge all repositories for multi-repository Projects); the Product owner then starts the next and picks what carries over.
- **Code:** The Code tab shows each file's last commit, and the Commits tab can browse files at any commit.
- **Audit:** Repository GitHub activity (pushes, pull requests, reviews, branches, tags) appears in the Audit trail, which is now readable and paged.
- **Home:** Laid out per role, with its own blocks and shortcuts for Developers, the QA Team, Product owners and admins.
- **Notifications:** Live workspace member alerts; the Inbox and badge update without reloading.
- **Branches:** `dev`, `uat` and `main` require a pull request on new projects, and admins can apply this to existing repositories.
- **Editions:** Build profiles (hosted, enterprise), per-client capability policies, and the Enterprise client-composition settings page.
- **Editions:** The `alphaexplora-internal` client policy for Alpha Explora's own Render and Vercel deployment, selected with `ALPHACI_CLIENT` (preset `deploy/env/enterprise-internal.env`).

### Changed

- **Documentation:** Clarified editions, personas, internal access, and capability inventory gaps; added a contributor guide for assigning features.
- **Roles:** `lead` is shown as Product owner; Developers and admins manage hosting and environment variables, Product owners no longer do.
- **Roles:** Repository tabs follow the viewer's role.
- **QA:** Verification is Pending, Passed or Failed, and Failed sends the story back to the Developers.
- **QA:** Merge to main needs every item of the iteration passed in an Approved run.
- **Repository page:** Hosting and Environment are one Hosting tab, Pipeline runs and Workflow one Pipeline tab, and the Overview is the same for everyone.
- **Create project:** One Hosting choice (Vercel / Render, On-prem host, or None) and fewer fields to fill in.
- **Navigation:** The header's team picker is the only team selector; Teams, Checklists and Team settings are pages of their own.
- **Navigation:** Nothing inside a project links to ALPHACI's own Vercel or Render dashboards or to GitHub.
- **Pipelines:** Generated pipelines use the Project's one coverage threshold on `dev`, `uat` and `main`.
- **Self-hosted:** Workspaces and notifications are on by default; existing installs add `WORKSPACES_ENABLED=true` and `NOTIFICATIONS_ENABLED=true` when they upgrade.
- **On-prem:** Enrollment offers the current agent when `ONPREM_INSTALLER_VERSION` is unset, and new frontend environments default to an automatic HTTPS address.

### Fixed

- **Projects:** Developers get GitHub Write on repositories whose names GitHub rewrites for team names, such as `web.app`; before this, only the first person granted got it. Each new grant or revoke request gets its full retry budget again.
- **Capabilities:** Unknown, duplicate, or empty edition selections fail before catalog writes. Hosting metadata includes the Hosts page, and capability descriptions cover the current QA and delivery workflows.
- **On-prem:** The Windows host install file now runs from an elevated PowerShell 7 window, where it stopped with `Get-FileHash` not recognized.
- **Hosting:** Saving or deleting a Render environment variable keeps the service's other variables when it has more than 20; before, the rest were erased.
- **Self-hosted:** A first install no longer risks `migrate` failing: the database counts as healthy only once it accepts TCP connections, not during its one-time setup.
- **Access:** One refused GitHub team-roster read no longer demotes every lead to Developer in the scheduled role sync; the sweep now skips when the lead or developer roster can't be read.
- **QA:** Report and CI results tables escape backslashes, so a cell ending in `\` no longer breaks the table.
- **Pipelines:** A new project starts one pipeline per branch, not one per generated file.
- **Pipelines:** New projects' pipelines pass from creation: images are named after the repository and installs skip npm releases younger than a day.
- **Pipelines:** A commit runs one pipeline chain while a pipeline-branch pull request is open; `uat` used to deploy twice.
- **QA:** QA Studio shows `uat` previews of ALPHACI-managed Vercel projects, which Vercel Authentication used to block.
- **Access:** Adding a project member grants their GitHub access again.
- **Runs:** A running job's log says it is not ready yet instead of reporting missing access; `startup_failure` runs show as failed.
- **Runs:** Terminal colour codes no longer appear in test output, and SonarCloud percentages show one decimal.
- **UI:** Secondary buttons are visible in the dark theme, and preview cards name the host when the API sends no label.
- **UI:** Signed-in pages no longer call workspace and notification endpoints that are turned off.
- **API:** Query parameters are read as single values: a repeated or nested one counts as absent instead of being joined, and an unknown feedback `status` filter returns 400.

### Security

- **API:** A crafted `Authorization` header or service path can no longer stall the API: CI token parsing and path trimming run in linear time.
- **Sign-in:** The GitHub callback accepts its `code` and `state` only as single values.
- **Pipelines:** Generated workflows no longer run stages chained off a fork's code, and write permissions sit only on the jobs that use them.
- **On-prem:** Replacing a host revokes its previous credentials.

### Development

- **Repository:** The API and web app live in one Turborepo monorepo with one documentation bundle in `docs/`.
- **Capabilities:** One authoring source, a catalog package with provenance, a capability ledger, and checks that keep packs and docs in step.
- **CI:** The API's database integration specs run against a disposable Postgres on every API change.
- **Deploy:** A green CI run on `main` deploys the enterprise instance and its settings, kept in the `enterprise-gce` GitHub environment, to its Compute Engine VM; migration changes stop for review.
