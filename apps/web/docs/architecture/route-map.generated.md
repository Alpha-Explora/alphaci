---
type: "Route Map"
title: "Frontend route map"
description: "Generated inventory of App Router pages and the feature barrels they compose."
tags: [architecture, routes, map]
status: stable
sources:
  - id: "app-router"
    resource: "src/app"
    title: "Next.js App Router pages"
---

# Frontend route map

The current App Router exposes **27 pages**. Routes under `src/app/` are a routing table. Feature code lives in `src/features/`.

| Route | Page module | Feature composition |
|---|---|---|
| `/` | `src/app/page.tsx` | `@/features/public-site` |
| `/activity` | `src/app/(platform)/activity/page.tsx` | `@/features/teams/activity` |
| `/admin` | `src/app/(platform)/admin/page.tsx` | `@/features/admin/users` |
| `/admin/feedback` | `src/app/(platform)/admin/feedback/page.tsx` | `@/features/admin/feedback` |
| `/admin/users/[id]` | `src/app/(platform)/admin/users/[id]/page.tsx` | `@/features/admin/user-detail` |
| `/auth/callback` | `src/app/(access)/auth/callback/page.tsx` | `@/features/auth/callback` |
| `/checklists` | `src/app/(platform)/checklists/page.tsx` | `@/features/teams/checklists` |
| `/groups/[groupId]` | `src/app/(platform)/groups/[groupId]/page.tsx` | `@/features/groups/detail` |
| `/groups/[groupId]/activity` | `src/app/(platform)/groups/[groupId]/activity/page.tsx` | `@/features/groups/activity` |
| `/groups/[groupId]/delivery-projects/[deliveryProjectId]` | `src/app/(platform)/groups/[groupId]/delivery-projects/[deliveryProjectId]/page.tsx` | `@/features/groups/delivery-project` |
| `/groups/[groupId]/members` | `src/app/(platform)/groups/[groupId]/members/page.tsx` | `@/features/groups/members` |
| `/groups/[groupId]/repositories/[repositoryId]` | `src/app/(platform)/groups/[groupId]/repositories/[repositoryId]/page.tsx` | `@/features/groups/repository` |
| `/groups/[groupId]/systems` | `src/app/(platform)/groups/[groupId]/systems/page.tsx` | `@/features/groups/systems` |
| `/groups/[groupId]/systems/[systemId]` | `src/app/(platform)/groups/[groupId]/systems/[systemId]/page.tsx` | `@/features/groups/system-detail` |
| `/guide` | `src/app/(public)/guide/page.tsx` | `@/features/guide/overview` |
| `/home` | `src/app/(platform)/home/page.tsx` | `@/features/home/dashboard` |
| `/inbox` | `src/app/(platform)/inbox/page.tsx` | `@/features/notifications/inbox` |
| `/login` | `src/app/(access)/login/page.tsx` | `@/features/auth/login` |
| `/projects/[projectId]` | `src/app/(platform)/projects/[projectId]/page.tsx` | `@/features/projects/detail` |
| `/projects/[projectId]/qa/report/[runId]` | `src/app/(platform)/projects/[projectId]/qa/report/[runId]/page.tsx` | `@/features/checklists/report` |
| `/qa/project-report/[deliveryProjectId]/[runId]` | `src/app/(platform)/qa/project-report/[deliveryProjectId]/[runId]/page.tsx` | `@/features/projects/detail` |
| `/runs` | `src/app/(platform)/runs/page.tsx` | `@/features/runs/list` |
| `/runs/report` | `src/app/(platform)/runs/report/page.tsx` | `@/features/checklists/report` |
| `/settings` | `src/app/(platform)/settings/page.tsx` | `@/features/settings/account` |
| `/signup` | `src/app/(access)/signup/page.tsx` | `inline route composition` |
| `/teams` | `src/app/(platform)/teams/page.tsx` | `@/features/teams/detail` |
| `/workflows` | `src/app/(platform)/workflows/page.tsx` | `@/features/workflows/studio` |

`/`, `/login`, `/signup`, and `/auth/callback` may contain small inline composition. Other pages re-export a feature view.

## Verification

Run `npm run arch:check` and `npm run generate:architecture-maps -- --check`.
