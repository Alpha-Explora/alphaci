# QA release-tracker port and follow-ups

Date: 2026-11-10. Status: Phase 1 is in review; Phase 0 needs an operator; Phases 2 to 6 are not started.

The QA release-tracker features (release versions, imports, QA history, special access, promotion override, story schedules, team to-dos, semantic coverage, side-by-side diffs, inbox categories, .NET detection) were built on the pre-monorepo repositories and never committed. Phase 1 ports them onto `main` with the fixes the current checks require. The other phases finish work that is stranded elsewhere and reconcile the hosted database.

Egress: the hosted Supabase project has been at its egress quota. Every phase checks the hosted database with catalog and count queries only, and never dumps, exports or bulk-reads it.

## Phase 0: hosted database (operator, needs approval)

Read-only check on 2026-11-10 (catalog and count queries only):

- Healthy: Postgres 17.6, 48 MB, 10 connections, the API health check reports the database up.
- The objects of every migration from 2026-10-15 to 2026-10-29 exist, including the six Phase 1 migrations, and all 24 Iterations already carry a version. Phase 1 needs no database change.
- `20261108010000_onprem_address_bindings` is not applied: `env_provisioning.onprem_certificates` and `onprem_hosts.binding_status` are missing, though the deployed API already expects them. Apply it.
- The migration ledger lacks eleven applied versions: `20261015020000`, `20261015030000`, `20261016010000`, `20261020010000`, `20261021010000`, `20261027000000`, `20261028000000`, `20261028020000`, `20261028030000`, `20261028040000` and `20261029000000`. Mark them applied as the [migration reconciliation runbook](../runbooks/runbook-migration-reconciliation.md) describes; do not re-run them.
- The ledger records `ci_run_reports_verify_stage` as `20260910183221`; its file is `20260911000000`. Reconcile the version in the same pass.

## Phase 1: port the features with their fixes (this pull request)

- Merge the uncommitted work onto `main`, formatted with `main`'s Prettier. Two real conflicts keep #54's release-governance gate; the override offer follows it too.
- Fix a Developer or QA member's 403 when ticking a to-do they did not create: the validation pipe's class instance carries undefined keys, so only sent fields count as an edit.
- Fix the import preview's 403 for a Developer holding `qa_release`: it uses the QA role, as saving test cases does.
- Coded errors for the new throws, `@QueryString` in the QA history controller, the eleven routes in the route inventory and the route-contracts baseline.
- Special access rules and the override reason length move into `@alphaci/persona-rules`.
- Lint: effects set state only in callbacks, diff mode reads storage with `useSyncExternalStore`, labelled diff cells, smaller view models.
- `features/checklists/coverage` becomes `semantic-coverage`, which the root `.prettierignore` (`**/coverage/`) would otherwise skip.
- Runbooks join `docs/runbooks`; the old per-app changelogs become root changelog lines.

## Phase 2: test case authors (#52, #53)

Those pull requests merged into their stack branches, not `main`. After Phase 1:

- Rebuild the two commits (`1e746367`, `7b258099`) on `main`, without the old copy of #51.
- Renumber `ADR-0023: Capability options` to ADR-0024; regenerate `provenance.json` and the architecture maps.
- Resolve the three service conflicts by keeping both changes: `canManageTestCases(await findQaRole(userId), testCaseAuthorsOf(options))`, the same for recording results, and both optional dependencies in `QaRequirementsService`.
- Then set `QA_TEST_CASE_AUTHORS=qa-team-and-leads` on the internal Render web service, if still wanted.

## Phase 3: response contracts for the new routes

The eleven routes are listed in `route-contracts.baseline.txt`. Declare their responses in `packages/api-contracts`, add schemas under `tests/e2e/support/contracts`, and shrink the baseline, so a changed response fails the web typecheck.

## Phase 4: workflow repository pull requests

`alphaci-workflow` #45 (.NET contract tests) and #47 (one coverage threshold) each conflict only in one document after that repository's docs refresh (#50). Rebase them and redo the document edits.

## Phase 5: pipeline owners

The `feat/pipeline-owners-ruleset` checkpoint is unfinished and has no UI. To land it: rebase onto `main`, resolve `github.service.ts`, renumber its ADR to 0025, move its docs and changelog line to the root, apply the coded-error and route rules, then finish and test the feature.

## Phase 6: release check

After Phase 1 deploys: walk each feature in the browser on the internal deployment with a Product owner, QA and Developer account, and watch Supabase egress for a week. Watch QA history paging, the audit-trail export and the to-do list (which reloads after every write).

