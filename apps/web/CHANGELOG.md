# Changelog

## [Unreleased]

### Added

- Added the Environments section at the top of a project's Hosting tab. Each project environment is listed in promotion order with its targets per slot, the release it runs (commit and image digests), anything in flight, and its recent deployments. Later environments offer one Promote action for the release the previous environment runs, show the backend's reason when a promotion is refused, and ask for a second click before deploying to production. When on-prem hosts are enabled, on-prem environments can register a host and show its token once. Projects on the legacy branch path are unchanged. On-prem targets are labelled "On-prem host" instead of falling back to Render.

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

- Updated the local catalog fixture to `@alphaci/capability-catalog@0.2.0`, including typed capability surface data.
- Regenerated the capability snapshot and OKF surface view from the vendored package; frontend checks now fail on surface drift.
- Changed capability and pack documentation checks to use the versioned package contract instead of a sibling backend checkout. Package publication remains outside this local change.
- Consolidated the root README and feature/shared notes so architecture and product status live in the documentation bundle.
- Made ADR-0003's rejected alternative precise, separating rejected pack duplication from permitted build-time exclusion.
