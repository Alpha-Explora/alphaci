---
type: "Playbook"
title: "Special access and deployment override"
description: "Grant QA release or deployment override access, audit gate overrides, and export the QA audit trail."
tags: [runbook, qa, promotion, access, migrations]
status: stable
---
# Special access and deployment override

## Installation

Apply this migration before deploying this backend and its matching frontend:

`supabase/migrations/identity-access/20261028000000_app_user_special_access.sql` adds `identity.app_users.special_access` (a text array limited to `qa_release` and `deployment_override`, empty by default).

It is additive; its rollback is `supabase/rollbacks/20261028000000_app_user_special_access_down.sql`.

## Special access

Special access sits on top of the persona (`app_role`). GitHub team sync never writes it, so a grant survives the next login. Set it with `PATCH /api/v1/admin/users/{id}/special-access` and body `{"access": ["qa_release"]}`. The response returns the stored list; `GET /api/v1/auth/me` returns it as `specialAccess`.

* `qa_release` lets a Developer act as the QA Team in QA runs: start a run, verify items, record test results, attach evidence, dispatch Playwright and sign off. Merge to main is already open to every persona once the gate passes. Product owner work stays with `lead`/`admin`: writing requirements, Product owner acceptance, reopening a signed-off run and starting the next iteration. Any platform admin may change it.
* `deployment_override` lets a person merge to main while the promotion gate is blocked. Admins always have it. Only the super-admin may grant or remove it.

Every change is recorded as the `admin.special_access.set` security audit event with the previous and new lists.

## Merging past a blocked gate

`POST /api/v1/projects/{projectId}/qa/promotion/merge` and `POST /api/v1/delivery-projects/{deliveryProjectId}/promotion/merge-all` accept an optional body `{"overrideReason": "..."}`. Without it a blocked gate answers `409 QA_PROMOTION_BLOCKED` exactly as before. With it:

* `403 DEPLOYMENT_OVERRIDE_FORBIDDEN` unless the caller is an admin or holds `deployment_override`.
* `400 OVERRIDE_REASON_REQUIRED` when the trimmed reason is shorter than 15 characters.
* `409 OVERRIDE_NEEDS_SIGNOFF` when no QA run of the current iteration was signed off: an override skips the gate's checks (Product owner acceptance, a moved head, a Conditional or Rejected verdict, unpassed items, changed requirements), never QA's sign-off itself.
* A delivered iteration still refuses with `409 ITERATION_DELIVERED`.

Each repository merged this way records `qa.promotion.override_merged` next to the usual `qa.promotion.merged`. Its metadata holds the written reason and every gate reason that was bypassed, and every lead except the actor is notified. `GET .../qa/promotion` returns `canOverride` so the frontend offers the action only to people who may use it.

## QA audit trail export

`GET /api/v1/delivery-projects/{deliveryProjectId}/qa-history/export` (optional `iterationId`) downloads the Dev and QA audit trail as an Excel workbook: newest first, one row per progress change, QA verdict, defect edit, fix submission and sign-off, with the actor, the from/to state and the notes. It is readable by anyone who can see the Project and includes at most the newest 5000 events, with a note row when it stops early. Notes are written as plain text.

## Existing repositories

Discovery (`POST /api/v1/existing-repos/discover`) now recognises a .NET repository from a `.sln`, `.slnx` or `.csproj` file at its root when there is no `package.json`.

## Verification

Focused checks: `npx jest src/kernel/rules/special-access.rules.spec.ts src/modules/projects/application/qa-runs src/modules/identity-access src/modules/projects/application/existing-repos src/modules/projects/application/qa-checklists/qa-history --coverage=false`, then `npm run build`, the route inventory test and `npm run check:documentation`.

