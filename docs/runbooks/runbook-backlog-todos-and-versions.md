---
type: "Playbook"
title: "Backlog deadlines, team to-dos and release versions"
description: "Apply and operate story due dates and priority, Project team to-dos and Iteration release versions."
tags: [runbook, qa, requirements, iterations, migrations]
status: stable
---
# Backlog deadlines, team to-dos and release versions

## Installation

Apply these additive migrations, in order, before deploying this backend and its matching frontend. Rollbacks are in `supabase/rollbacks/` with the same timestamps.

1. `supabase/migrations/projects/20261028020000_iteration_versions.sql` adds `version_major`, `version_minor` and `revision_type` to `projects.project_iterations` and backfills existing Iterations as v1.0, v1.1, v1.2 in their order. A unique index keeps each version once per Project. The columns have no defaults: a `BEFORE INSERT` trigger (`project_iteration_default_version`) gives an Iteration inserted without a version the next minor version, so a backend that predates versions keeps starting Iterations while this migration is live.
1. `supabase/migrations/projects/20261029000000_iteration_version_patch.sql` adds `version_patch` (existing Iterations get 0, so v1.2 reads v1.2.0), allows `revision_type = 'patch'`, and replaces the unique index with `uq_project_iterations_semver` on major, minor and patch. The trigger gives an Iteration inserted without a version patch 0. Rollback: `supabase/rollbacks/20261029000000_iteration_version_patch_down.sql`, which refuses to run while two Iterations of a Project differ only by patch.
2. `supabase/migrations/projects/20261028030000_backlog_schedule.sql` adds nullable `due_date` and `priority` to `projects.qa_checklist_items`.
3. `supabase/migrations/projects/20261028040000_project_todos.sql` creates `projects.project_todos` with row level security on and no grants to `anon` or `authenticated`.

A backend running before these migrations keeps working; the frontend hides versions, schedules and to-dos when the server does not send them.

## Release versions

`POST /api/v1/delivery-projects/{id}/iterations` takes an optional `revisionType`: `minor` (the default, v1.2.0 to v1.3.0), `patch` (v1.2.1, fixes only) or `major` (v2.0.0). Iteration payloads carry `version { major, minor, patch, label }` and `revisionType`; a run's detail and the promotion status carry `iteration.versionLabel`. The `qa.iteration.delivered` audit event records `version` and `revisionType`, its notification names the version, and the QA report workbook's Summary has a Version row. Git tags are not created.

## Story due dates and priority

`PATCH /api/v1/requirements/{id}/items/{itemId}/schedule` with `{ "dueDate": "YYYY-MM-DD" | null, "priority": "low" | "medium" | "high" | "urgent" | null }`. Omitted keys are left; `null` clears. Product owners and admins only, on an active Iteration and a non-archived Feature. Scheduling does not bump `row_version`, so a Developer's progress write is never made stale by it, and it does not reopen QA review. Each change records `requirement.updated` with `change: scheduled`. A Done story is never shown as overdue.

## Team to-dos

| Route | Who |
|---|---|
| `GET /api/v1/delivery-projects/{id}/todos` | Any Project member. Returns open to-dos (soonest due, then highest priority) and those done in the last 30 days, plus the assignable team. |
| `POST /api/v1/delivery-projects/{id}/todos` | `lead`, `member`, `qa`, `admin`. `{ title, notes?, assigneeId?, dueDate?, priority? }`. |
| `PATCH /api/v1/delivery-projects/{id}/todos/{todoId}` | Any of those roles may change `status`; only the creator, a `lead` or an `admin` may change anything else. Requires `expectedRowVersion`; a moved version answers `409 PROJECT_TODO_STALE`. |
| `DELETE /api/v1/delivery-projects/{id}/todos/{todoId}` | The creator, a `lead` or an `admin`. |

An assignee must be an active member of the Project's team with a team persona; anyone else answers `400 PROJECT_TODO_ASSIGNEE_INVALID`. Assigning someone other than yourself records the `project.todo.assigned` notification, which opens the repository's Checklists tab. Deleting a Project removes its to-dos through `DELIVERY_PROJECT_DATA_CLEANUP`.

## Verification and rollback

Run the focused Jest suites (`backlog-schedule.rules`, `qa-requirements.service`, `project-todos.service`, `project-iterations`), `tsc`, the route inventory, application-boundary and schema-ownership checks. These are unit checks; confirm the migrations on the target database and a real assignment notification after deployment. Roll back the application first. The to-do rollback drops the table and its data, so export anything worth keeping before running it.
