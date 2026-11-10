---
type: "Playbook"
title: "QA imports and progress history"
description: "Operate shared release execution, transactional progress history, and grouped checklist imports."
tags: [runbook, qa, imports, migrations]
status: stable
---
# QA imports and progress history

## Release authority

Product Owners (`lead`), QA (`qa`), Developers (`member`) and administrators can execute the existing QA promotion endpoints. Workspace visibility, current repository heads, the approved QA sign-off, complete iteration coverage, Product Owner acceptance, GitHub permissions and delivered-iteration checks still apply. The merge endpoints recompute readiness and check the pull request head before writing. Product Owner acceptance and starting the next iteration remain `lead`/`admin` actions. A successful merge is evidence of source promotion; inspect deployment status separately.

## Installation

Apply `supabase/migrations/projects/20261027000000_qa_progress_history.sql` before deploying this backend and its matching frontend. It needs the existing QA, iteration, test-case and Product Owner acceptance migrations. It works with PostgreSQL in both hosted and self-hosted installations and introduces no storage bucket or external worker. It does not install an external Playwright runner.

The migration adds `projects.qa_progress_events` and a trigger recording every changed developer progress value in the same transaction as its write, including QA-initiated resets. Records contain the item and requirement titles at that time. It does not manufacture earlier progress events. QA events and sign-offs remain in their existing tables. Direct `anon`/`authenticated` access is revoked and RLS is enabled; API reads authorize project visibility first.

Definition-change triggers also touch the owning requirement so edits after sign-off close the promotion gate. Open-run synchronization resets an affected story pass and Product Owner acceptance, preserving existing failures when its definitions change; changed test titles or expectations also reset that test's result. Signed-off copies remain frozen. Reopen and review the run to approve the new definitions.

## API contracts

All paths below are under `/api/v1` and require a session and `projects.qa-checklists`.

| Route | Contract |
|---|---|
| `GET /delivery-projects/:id/qa-history` | Project-visible readers; optional UUID `itemId`/`iterationId` and opaque `before` cursor. Newest first, 50 events plus `nextCursor`. Timestamp and ID ordering preserves tied timestamps and database precision. |
| `POST /delivery-projects/:id/qa-import-preview` | PO, QA and admin; multipart `file`; read-only `{ sheets: [{ name, headers, rows }] }`. No file retention. |
| `POST /delivery-projects/:id/requirements/batch` | Existing PO/admin atomic creation endpoint. Import mapping produces new functional Features and stories; existing names return a conflict. |
| `POST /requirements/:id/items/:itemId/test-cases/import` | QA/admin; `{ rows: [{ category, title, expectedResult }] }`; atomic additions to a writable functional story. Returns its test categories and `added`/`skipped` counts. |

Preview accepts `.xlsx`, `.csv`, and `.tsv`, at most 2 MB, 1000 data rows across sheets, 12 columns and 20 sheets. XLSX inflation is independently bounded to 10 MB before ExcelJS parses XML. Encrypted/macro/external-link workbooks, formulas, malformed archives, oversized cells and unsupported formats are rejected. Cells are literal text; formulas are never evaluated. Users choose one sheet and explicitly map grouping, title and optional details; filling down blank groups is opt-in.

QA imports serialize on the story and recheck active iteration/archive/scope inside the transaction. Existing identical cases are skipped; changed or ambiguous same-title cases abort the whole batch. There is no title-based overwrite or deletion. Category/case limits remain 20/50. Edit existing definitions through their version-checked editor. Imported rows cannot supply progress, QA results, acceptance, authors or foreign ownership IDs.

QA item refusal notifications retain their existing deduplicated change-only delivery. A whole-run rejected sign-off now sends `qa.run.rejected` to the owner, starter, leads and developers except the actor. It does not falsely fail every story; its frozen report and rejection summary remain visible, and an authorized owner can reopen it.

## Verification and rollback

### Playwright files

The file preview also accepts a Playwright spec (`.ts`, `.js`, `.mjs`, `.cjs`) or the JSON reporter's output (`npx playwright test --list --reporter=json`). The source is tokenised as text, never executed or imported. Each `describe` path becomes a Category, each `test` a test case, and the full title (`Describe › test`) is offered as a fourth column. At most 1000 tests.

Run the focused QA unit suites, typecheck, lint, application-boundary and route-inventory checks. `tests/integration/qa-history-imports.integration.spec.ts` supports an empty disposable database through `MIGRATION_TEST_DB_URL`; never point it at shared data. For an isolated SQL check without Docker, install `@electric-sql/pglite` outside the application and set `QA_HISTORY_PGLITE_MODULE` to its absolute module directory, then run Jest through `node --experimental-vm-modules`. That path applies real QA migrations to minimal parent fixtures; it does not replace full migration replay or multi-session PostgreSQL lock tests.

Rollback the application first if necessary, retaining the additive history table and its records. Do not drop the journal to roll back the UI. Migration rollback in `supabase/rollbacks/20261027000000_qa_progress_history_down.sql` refuses to erase recorded progress; archive and approve any data removal separately. Verify real notification delivery and provider deployment outcomes in the target installation after deployment.
