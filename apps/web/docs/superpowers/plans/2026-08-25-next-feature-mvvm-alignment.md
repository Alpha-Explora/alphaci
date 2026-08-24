# Next Feature MVVM Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the entire frontend with progressive Next feature MVVM while preserving every existing user-visible behavior and backend contract.

**Architecture:** Organize `src/app` by invisible Next.js route groups for access, public, and authenticated-platform navigation contexts; it stays a thin routing table. Each domain action owns its JSX in `views/`, orchestration in `view-models/`, pure types and rules in `model/`, and all transport/DTO work in `data/`. `src/shared` is reserved for domain-free primitives and static shell pieces; the legacy `src/components`, `src/hooks`, and domain-specific `src/lib` modules are eliminated only after their owners have been migrated.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Jest 30, dependency-cruiser, the vendored Next feature-architecture checker.

## Implementation ledger

This plan is being implemented on `codex/next-mvvm-implementation`, based on
the protected `codex/next-mvvm-trunk` branch. `main` remains untouched and no
pull request is opened against it during the migration.

Completed in the implementation branch:

- invisible `(access)`, `(public)`, and `(platform)` route groups with the
  existing URL map preserved;
- domain-free shell primitives moved to `shared/`, and product UI moved into
  owning feature/action `views/` folders;
- auth, workspace selection, capabilities, groups, projects, workflow studio,
  home, teams, settings, guide, and admin public barrels updated;
- domain API modules moved out of `src/lib/api/` into feature `data/` layers,
  generic transport retained in `src/shared/api/`, and legacy source roots
  emptied;
- domain-only root barrels added where cross-action consumers need a stable
  public contract, with dependency cycles removed;
- architecture tests and strict legacy-root/dependency checks added.

The implementation deliberately preserves existing component state timing and
request payloads. The remaining checklist below is the review map for those
behavior-preserving moves; no behavior change or persistent platform layout is
part of this branch.

## Global Constraints

- This is a behavior-preserving refactor: preserve routes, API requests, payloads, query parameters, redirects, copy, accessibility attributes, CSS selectors, and visual cascade.
- Do not introduce React Query, a state-management library, server actions, or `use-cases/`/`views/steps/` folders. Existing slices are Level 0 or Level 1.
- A feature `model/` must not import React, Next, `ApiError`, API DTOs, or any `src/lib/api/**` module.
- A feature `view-models/` module exposes one `status` and a render-safe `error` for every interactive surface. It owns effects, request counters, commands, auth/session coordination, and navigation decisions.
- A `views/` module renders VM output and delegates events to VM commands. It cannot fetch, call repositories, import `src/lib/api`, or invoke cross-cutting feature hooks directly.
- A `views/` module may render `next/link`, but may not call `useParams`, `useSearchParams`, or `useRouter`; ViewModels own Next navigation hooks, route state, redirects, and navigation commands.
- A feature `data/` module is the only owner of feature I/O and maps API DTOs into feature model types before returning them.
- `shared/ui` and `shared/layout` are domain-free. A component mentioning a domain entity belongs in that domain feature even if more than one action needs it.
- `shared/api` contains only generic transport (`request`, base-URL configuration, and transport error types). Domain API modules and raw DTOs move into their owning feature `data/` folders; they do not become a second shared API facade.
- A domain-specific helper under `src/lib` moves to the owning feature model/data layer. Only pure helpers that genuinely serve two or more domains move to `shared/lib`.
- During a migration task, update every consumer in the same commit. Do not retain deep-import compatibility shims.
- Next.js route groups (`(access)`, `(public)`, `(platform)`) are organizational only and must not alter any existing URL, parameter, redirect, metadata, loading state, or route-template behavior.
- This plan does not add `app/(platform)/layout.tsx`. A persistent layout changes component lifetime, loading UI, and guest/redirect policy; it requires a separate approved behavior-change specification.
- Preserve the existing CSS import order in `src/app/globals.css`; move CSS only when its selector/declaration multiset and ordering are proven unchanged.
- Do not push to `main`.

## Definition of Done

- Every route remains a route-only composition entry point.
- The App Router is grouped by navigation context without URL changes; route-local templates retain their current transition behavior.
- No source files remain under `src/components/` or `src/hooks/`, and no domain-specific API/helper modules remain under `src/lib/`.
- Every interactive feature action has a VM-owned `status` and safe `error`.
- Every API DTO is contained within its owning `data/` layer; feature models expose stable feature types.
- `shared/` has no feature import and no domain language.
- `npm run boundaries`, `npm run arch:check`, lint, typecheck, unit tests, and build all pass (except the documented ten pre-existing jsdom helper failures, if still present unchanged).

## Route Contract

The `app/` directory is the complete URL map, organized by navigation context rather than product domain. Parenthesized folders are Next.js route groups and do not appear in URLs. Route files contain only composition, metadata, and unavoidable Next.js framework boundaries; all URLs, parameters, templates, and redirects remain unchanged.

| URL | Final `app/` location | Feature entry point | Route rule |
|---|---|---|---|
| `/` | `app/page.tsx` | none | Keep the existing server redirect to `/login`. |
| `/login` | `app/(access)/login/page.tsx` | `features/auth/login` | Compose `OAuthLoginView` through the action barrel. |
| `/signup` | `app/(access)/signup/page.tsx` | none | Keep the existing server redirect to `/login`. |
| `/auth/callback` | `app/(access)/auth/callback/page.tsx` | `features/auth/callback` | Keep `Suspense` at the route boundary; import only the callback feature barrel and shared loader. |
| `/guide` | `app/(public)/guide/page.tsx` | `features/guide/overview` | One-line action-barrel export. |
| `/home` | `app/(platform)/home/page.tsx` | `features/home/dashboard` | One-line action-barrel export. |
| `/inbox` | `app/(platform)/inbox/page.tsx` | `features/notifications/inbox` | One-line action-barrel export. |
| `/runs` | `app/(platform)/runs/page.tsx` | `features/runs/list` | One-line action-barrel export. |
| `/settings` | `app/(platform)/settings/page.tsx` | `features/settings/account` | One-line action-barrel export. |
| `/teams` | `app/(platform)/teams/page.tsx` | `features/teams/detail` | One-line action-barrel export. |
| `/workflows` | `app/(platform)/workflows/page.tsx` | `features/workflows/studio` | One-line action-barrel export. |
| `/projects/[projectId]` | `app/(platform)/projects/[projectId]/page.tsx` | `features/projects/detail` | One-line action-barrel export; the feature VM receives the route parameter through a thin route adapter or view input. |
| `/admin` | `app/(platform)/admin/page.tsx` | `features/admin/users` | The nested admin layout composes admin feature barrels only. |
| `/admin/feedback` | `app/(platform)/admin/feedback/page.tsx` | `features/admin/feedback` | One-line action-barrel export. |
| `/admin/users/[id]` | `app/(platform)/admin/users/[id]/page.tsx` | `features/admin/user-detail` | One-line action-barrel export. |
| `/groups/[groupId]` | `app/(platform)/groups/[groupId]/page.tsx` | `features/groups/detail` | One-line action-barrel export. |
| `/groups/[groupId]/activity` | `app/(platform)/groups/[groupId]/activity/page.tsx` | `features/groups/activity` | One-line action-barrel export. |
| `/groups/[groupId]/members` | `app/(platform)/groups/[groupId]/members/page.tsx` | `features/groups/members` | One-line action-barrel export. |
| `/groups/[groupId]/repositories/[repositoryId]` | `app/(platform)/groups/[groupId]/repositories/[repositoryId]/page.tsx` | `features/groups/repository` | One-line action-barrel export. |
| `/groups/[groupId]/systems` | `app/(platform)/groups/[groupId]/systems/page.tsx` | `features/groups/systems` | One-line action-barrel export. |
| `/groups/[groupId]/systems/[systemId]` | `app/(platform)/groups/[groupId]/systems/[systemId]/page.tsx` | `features/groups/system-detail` | One-line action-barrel export. |
| `/groups/[groupId]/delivery-projects/[deliveryProjectId]` | `app/(platform)/groups/[groupId]/delivery-projects/[deliveryProjectId]/page.tsx` | `features/groups/delivery-project` | One-line action-barrel export. |

Do not add domain-named route groups such as `(projects)` or `(groups)`: that duplicates the `features/` domain tree. `app/` expresses URL and chrome context; `features/` expresses ownership and behavior.

## Deferred Follow-On: Persistent Platform Layout

`app/(platform)/layout.tsx` is deliberately outside this behavior-preserving migration. The current product routes have distinct loading labels, signed-out redirects, guest states, and shell composition: for example, `/home` redirects to `/login?next=/home`, `/projects/[projectId]` preserves its project-specific next path, and `/runs` has its own Suspense fallback. A persistent layout would change when those states mount and whether navigation/background chrome appears.

After this plan is complete, create a separate specification if the product wants to standardize those behaviors. That specification must define a route-by-route loading, signed-out, guest, error, navigation, and template-transition matrix before introducing a Level 2 `features/platform/shell` and `app/(platform)/layout.tsx`.

## Domain Modeling Position

This plan uses **DDD-lite**, not full tactical DDD.

- The existing feature domains (`projects`, `groups`, `workflows`, `notifications`, and so on) are the frontend's bounded-context-like ownership boundaries and retain the backend module names where possible.
- Feature `model/` modules define the frontend ubiquitous language: stable types and pure decisions such as project lifecycle display, repository ownership, member roles, and notification presentation.
- Repositories in `data/` are anti-corruption layers: they translate backend/API DTOs into feature model types, so vendor/transport contracts do not leak into views or models.
- Do not introduce aggregates, repositories as write-model abstractions, domain events, command buses, entity classes, or event sourcing. They would add ceremony without changing the frontend's responsibility.
- When terminology is ambiguous, define it once in the owning feature model and reuse that type/rule rather than duplicating strings or API DTO aliases.

This keeps the useful DDD outcomes—clear ownership, stable domain language, and protected boundaries—while preserving the lean MVVM architecture required by this application.

## Target Ownership Map

| Current owner | Future owner |
|---|---|
| `components/auth`, `app/auth/callback/callback-client.tsx`, `hooks/use-auth-session.ts` | `features/auth/{login,callback,session}` |
| `hooks/use-capabilities.ts`, `lib/api/capabilities.ts` | `features/capabilities/current` public ViewModel and data layer |
| `components/layout/app-nav.tsx`, workspace context/switcher, workspace hooks | `features/workspace/selection` public views and ViewModels; route features retain their existing shell placement |
| `components/hierarchy/**`, `hooks/use-hierarchy.ts` | `features/groups/{activity,delivery-project,detail,members,repository,system-detail,systems,workspace}` |
| Project detail tabs, project environment/workspace panels, service logs, and environment-provisioning hook | `features/projects/detail` |
| Workflow builder, setup/current tabs, project-creation/provisioning/catalog/history/provider hooks, and product tours | `features/workflows/studio` |
| `welcome-modal` | `features/home/dashboard` |
| `group-workspace-panel` | `features/teams/detail` |
| `workspace-members-section` | `features/settings/account` |
| Admin gate/header | `features/admin` |
| `flow-explainer` | `features/guide/overview` |
| Domain-free backgrounds, loader, theme primitives, generic help tip | `shared/{layout,ui}` |

## Transport and Helper Ownership Matrix

| Current module | Final owner and rule |
|---|---|
| `lib/api/request.ts` | `shared/api/request.ts`; the only shared HTTP transport and `ApiError` owner. |
| `lib/api/admin.ts` | `features/admin/data/`; map admin DTOs before returning them. |
| `lib/api/auth.ts` | `features/auth/session/data/` for session/authentication behavior; workflow-studio onboarding calls use shared transport from their own data layer. |
| `lib/api/capabilities.ts` | `features/capabilities/current/data/`. |
| `lib/api/catalog.ts`, `existing-repos.ts`, `github.ts`, `workflows.ts` | `features/workflows/studio/data/`, because the only current consumer surface is Workflow Studio. |
| `lib/api/env-provisioning.ts`, `project-workspace.ts`, `projects.ts`, `usage.ts` | Split endpoint functions by current owner: Workflow Studio setup/provisioning calls move to `features/workflows/studio/data/`; project-detail calls move to `features/projects/detail/data/`. |
| `lib/api/hierarchy.ts`, `hierarchy-contracts.ts` | `features/groups/data/` for group actions. Home and teams define their own data-layer DTO projections rather than importing groups internals. |
| `lib/api/runs.ts` | `features/runs/data/`. |
| `lib/api/workflows.ts` | `features/workflows/studio/data/`. |
| `lib/api/workspaces.ts` | `features/workspace/selection/data/`. |
| `lib/api/client.ts`, `lib/api/contracts.ts` | Remove after all callers use owning feature data modules. These are transitional aggregators, not final shared APIs. |
| `lib/auth/subscription.ts` | `features/auth/session/model/`; other features receive stable session facts through the auth-session public barrel. |
| `lib/hosting/provider-urls.ts` | `features/projects/detail/model/` unless a second domain gains a real use. |
| `lib/onboarding/*.ts` | `features/workflows/studio/views/tours/`; these modules use browser/driver.js behavior and are not pure model code. |
| `lib/navigation.ts` | `features/workflows/studio/view-models/` while it has one Workflow Studio consumer; move to `shared/lib/` only after a second independent domain uses it. |
| `lib/theme-context.tsx` | `shared/layout/theme-context.tsx`, as a domain-free global presentation provider. |

## File Structure After Migration

```text
src/
  app/
    (access)/
      login/page.tsx                 # /login
      signup/page.tsx                # /signup
      auth/callback/page.tsx         # /auth/callback
    (public)/
      guide/page.tsx                 # /guide
    (platform)/
      home/
        page.tsx
        template.tsx
      inbox/page.tsx
      runs/page.tsx
      settings/
        page.tsx
        template.tsx
      teams/page.tsx
      workflows/
        page.tsx
        template.tsx
      projects/[projectId]/page.tsx
      groups/[groupId]/
        page.tsx
        activity/page.tsx
        members/page.tsx
        repositories/[repositoryId]/page.tsx
        systems/page.tsx
        systems/[systemId]/page.tsx
        delivery-projects/[deliveryProjectId]/page.tsx
      admin/
        layout.tsx
        page.tsx
        feedback/page.tsx
        users/[id]/page.tsx
    globals.css
    layout.tsx                       # document, fonts, global theme only
    page.tsx                         # / redirect only
  features/
    admin/{data,model,feedback,user-detail,users}/
    auth/{callback,login,session}/
    capabilities/current/{data,model,view-models,index.ts}
    groups/{data,model,activity,delivery-project,detail,members,repository,system-detail,systems,workspace}/
    guide/overview/
    home/dashboard/
    notifications/{data,model,inbox,preferences,summary}/
    projects/{data,model,detail}/
    runs/{data,model,list}/
    settings/{data,model,account}/
    teams/{data,model,detail}/
    workflows/studio/
    workspace/selection/
  shared/
    api/                            # request, base-URL configuration, transport errors only
    layout/                         # stateless backgrounds, loader, public chrome
    ui/                             # domain-free primitives only
    styles/
    lib/                            # pure cross-domain helpers
  styles/                           # retained global cascade during migration
```

---

### Task 1: Establish the characterization baseline and migration guardrails

**Files:**
- Modify: `src/features/README.md`
- Modify: `CLAUDE.md`
- Modify: `scripts/check-boundaries.mjs`
- Create: `tests/unit/architecture/feature-mvvm-boundaries.test.ts`

**Consumes:** The current route and feature structure.

**Produces:** A documented end-state and tests that make illegal new code fail before legacy modules are removed.

- [ ] Record the behavior-preservation contract from this plan in `src/features/README.md`: no domain additions to `components/` or `hooks/`; every moved surface must retain its route behavior and public barrel.
- [ ] Add a unit test that invokes the checker and asserts zero violations for `src/features` and `src/app/**/page.tsx`.
- [ ] Extend `scripts/check-boundaries.mjs` with a warning-only inventory for legacy runtime API imports in `src/components`, `src/hooks`, and non-page `src/app` files. The warning must name the file and owning migration bucket; it must not fail until Task 10.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run boundaries`, `npm run arch:check`, and `npm test`; record the exact pre-existing failures before changing application code.
- [ ] Commit the guardrail-only change with `test(architecture): characterize feature mvvm migration`.

### Task 2: Reorganize the App Router with behavior-preserving route groups

**Files:**
- Move: `src/app/{login,signup,auth,guide,home,inbox,runs,settings,teams,workflows,projects,groups,admin}` into the route-group locations specified in the Route Contract
- Modify: `src/app/layout.tsx`, route-relative imports, and any tests that name physical App Router paths
- Test: `tests/e2e/playwright-e2e.ts` and route/import assertions in `tests/unit/architecture/feature-mvvm-boundaries.test.ts`

**Consumes:** Task 1's route characterization baseline.

**Produces:** The three invisible route groups—`(access)`, `(public)`, and `(platform)`—with every public URL unchanged and no new group layout yet.

- [ ] Add route-characterization coverage for all 22 URLs, including dynamic group, project, repository, system, delivery-project, and admin-user paths; assert the generated URL does not contain a parenthesized route-group segment.
- [ ] Move the access routes to `app/(access)/`, `guide` to `app/(public)/`, and all authenticated product/admin routes to `app/(platform)/` exactly as listed in the Route Contract.
- [ ] Keep `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/(platform)/admin/layout.tsx`, and the three existing route-local templates intact in behavior. Repair relative imports after the moves; feature imports must remain barrel imports.
- [ ] Do not create `app/(access)/layout.tsx` or `app/(platform)/layout.tsx` in this task. The move must be filesystem-only from the browser's perspective.
- [ ] Run the route-characterization tests, `npm run typecheck`, `npm run boundaries`, `npm run arch:check`, and `npm run build`; compare the produced route manifest and tested redirect behavior with the Task 1 baseline.
- [ ] Commit with `refactor(routes): group app router by navigation context`.

### Task 3: Make shared code genuinely domain-free

**Files:**
- Move: `src/components/layout/{dither-background,flow-background,pipeline-loader,public-site-nav,theme-toggle}.tsx` to `src/shared/layout/`
- Move: `src/components/product/help-tip.tsx` to `src/shared/ui/help-tip.tsx`
- Move: `src/lib/theme-context.tsx` to `src/shared/layout/theme-context.tsx`
- Modify: all imports of the moved modules, `src/app/layout.tsx`, and `src/app/auth/callback/page.tsx`
- Test: existing tests that import moved shell components; add `tests/unit/shared/layout/theme-context.test.tsx` if no equivalent test moves with it

**Consumes:** Task 1 guardrails.

**Produces:** A real domain-free shared layer; no shared module imports from a feature or API client.

- [ ] Move only modules whose props and behavior contain no product-domain vocabulary and perform no feature I/O.
- [ ] Preserve named exports, prop types, CSS class names, and `"use client"` directives. Update import paths atomically rather than leaving re-export files in `components/`.
- [ ] Keep `AppNav`, `WorkspaceProvider`, and `WorkspaceSwitcher` out of `shared`: they presently own notification/workspace/session behavior and are migrated in Tasks 4–5.
- [ ] Run the moved component tests, then `npm run boundaries` and `npm run arch:check`.
- [ ] Commit with `refactor(shared): separate domain-free shell primitives`.

### Task 4: Extract auth, callback, and session orchestration into feature slices

**Files:**
- Create: `src/features/auth/callback/{data,model,view-models,views,index.ts}`
- Create: `src/features/auth/login/{data,view-models,views,index.ts}`
- Create: `src/features/auth/session/{data,model,view-models,index.ts}`
- Move: `src/app/auth/callback/callback-client.tsx` into `features/auth/callback/views/`
- Move: `src/components/auth/oauth-auth-page.tsx` into `features/auth/login/views/`
- Move: `src/hooks/use-auth-session.ts` into `features/auth/session/view-models/`
- Modify: `src/app/{login,page,signup}.tsx`, `src/app/auth/callback/page.tsx`, and all feature consumers of `useAuthSession`
- Test: move `tests/unit/use-auth-session*.test.tsx` to `tests/unit/features/auth/session/view-models/`; add callback VM tests under `tests/unit/features/auth/callback/view-models/`

**Consumes:** shared loader/background primitives from Task 3.

**Produces:** `AuthCallbackView`, `OAuthLoginView`, and `useAuthSessionViewModel` public exports, each reached through an `index.ts` barrel.

- [ ] First add characterization tests for callback outcomes: valid next paths, provider selection, archived-account restore, start-fresh failure, authentication failure, and signed-in redirect behavior.
- [ ] Keep URL sanitization and display-message functions pure in `features/auth/callback/model/`. Keep `getAuthSession`, account restoration, fresh-account calls, login-URL construction, and backend warmup in `callback/data/` or `login/data/`.
- [ ] Expose a callback VM state with `status: "checking" | "ready" | "failed" | "archived-choice"`, a safe `error`, and restore/start-fresh/retry commands. The callback view only renders it.
- [ ] Move `useRouter` and `useSearchParams` from callback/login views into their VMs. Keep the route-level `Suspense` boundary where a VM still uses `useSearchParams`.
- [ ] Update every existing consumer to import the auth-session public barrel rather than `src/hooks/use-auth-session`. Only Auth feature views move session orchestration in this task; Tasks 6–8 move the remaining domain calls from views into their owning VMs.
- [ ] Keep `/`, `/login`, `/signup`, and `/auth/callback` URLs and redirects unchanged. `app/auth/callback/page.tsx` becomes a feature-barrel composition only.
- [ ] Run auth unit tests, `npm run typecheck`, `npm run boundaries`, `npm run arch:check`, and the login/callback E2E path.
- [ ] Commit with `refactor(auth): move callback and session behavior into features`.

### Task 5: Establish workspace selection and feature-owned navigation

**Files:**
- Create: `src/features/workspace/selection/{data,model,view-models,views,index.ts}`
- Create: `src/features/capabilities/current/{data,model,view-models,index.ts}`
- Move: `src/components/layout/{app-nav,workspace-context,workspace-switcher}.tsx` into `features/workspace/selection/`
- Move: `src/hooks/use-capabilities.ts` into `features/capabilities/current/view-models/`
- Modify: every current capability-hook consumer to import the capability feature barrel; feature-view callers are moved into their own VMs in Tasks 6–8
- Test: move `tests/unit/workspace-switcher.test.tsx` and add `tests/unit/features/workspace/selection/view-models/use-workspace-selection-view-model.test.tsx`
- Test: create `tests/unit/features/capabilities/current/view-models/use-capabilities-view-model.test.tsx`

**Consumes:** the auth/session public barrel from Task 4.

**Produces:** Workspace-selection and current-capabilities public ViewModels, plus an API-free navigation view exported through a feature barrel; each route preserves its current shell placement and loading/guest behavior.

- [ ] Keep workspace local-storage persistence and workspace refresh registration behavior unchanged, but place state and commands in the selection VM.
- [ ] Put workspace DTO mapping and `getMyWorkspaces` calls in `workspace/selection/data/`; expose feature `WorkspaceSummary` model types instead of `WorkspacesMeResponse` outside data.
- [ ] Move `getCapabilities` and its fallback feature-flag policy into `capabilities/current/data/` and `model/`. Expose `useCapabilitiesViewModel` with one `status`, a safe `error`, and the same conservative defaults the current hook returns on failure.
- [ ] Update all consumers to use `@/features/capabilities/current`. Move calls from settings/project/workflow views into their owning VMs in later domain tasks; do not leave a `src/hooks/use-capabilities.ts` compatibility re-export.
- [ ] Change `AppNav` into a feature-owned view that receives notification/session/workspace values through VMs and feature-barrel imports, rather than importing API modules directly. Existing route features continue to decide when to render it.
- [ ] Preserve the existing notification-summary cycle avoidance: navigation consumes only `features/notifications/summary` through its barrel.
- [ ] Run workspace/nav unit tests and the authenticated smoke path before committing `refactor(workspace): move app shell orchestration into feature mvvm`.

### Task 6: Migrate the groups hierarchy into group action slices

**Files:**
- Move: `src/components/hierarchy/**` into the existing `src/features/groups/{activity,delivery-project,detail,members,repository,system-detail,systems}/views/` folders or `groups/workspace/`
- Move: `src/hooks/use-hierarchy.ts` into `src/features/groups/data/` and action VMs
- Modify: `src/features/groups/{data,model}/**`, affected action VMs/views, and their action barrels
- Test: move `tests/unit/{use-hierarchy,side-tabs}.test.tsx` and add VM tests under `tests/unit/features/groups/**`

**Consumes:** Tasks 3–5.

**Produces:** Each groups action owns its dialogs, tables, badges, shell composition, mutation commands, safe errors, and mapped models.

- [ ] Before moving each action, add a characterization test for its load/mutation behavior: members add/remove/role update, repository assignment/configuration, delivery project/repository creation, and system/project navigation.
- [ ] Move every direct hierarchy API call from JSX into `groups/data/groups-repository.ts` or a narrowly scoped action `data/` repository. Translate API error objects to safe strings in a VM/data mapper.
- [ ] Move every group, repository, system, and delivery-project `useParams` call from a view into its action VM. The VM exposes the resolved IDs and navigation commands required by the view.
- [ ] Keep shared group-only shell/presentation code behind a `features/groups/workspace/index.ts` barrel; do not create `shared/ui` components that know group, repository, or delivery-project vocabulary.
- [ ] Replace API DTO aliases in `groups/model` with feature types and mapping functions in data.
- [ ] After each action is green, update its route only through its existing action barrel; run action tests plus `npm run boundaries` and `npm run arch:check`.
- [ ] Commit separately per action so every commit is independently testable.

### Task 7: Migrate the project-detail vertical

**Files:**
- Move: `src/components/product/{project-detail-tabs,project-env-panel,service-logs-console}.tsx` into `projects/detail/views/`
- Move: `src/components/product/workspace/{code-tab,pipeline-runs-tab,pull-requests-tab,workspace-states}.tsx` into `projects/detail/views/workspace/`
- Move: `src/hooks/use-project-env-provisioning.ts` into `features/projects/detail/view-models/`
- Modify: `src/features/projects/{data,model,detail}/**`
- Test: move project panel/API tests to `tests/unit/features/projects/**`

**Consumes:** session and workspace feature barrels.

**Produces:** Project VMs own authentication gating, route navigation, command state, and errors; project views are API-free.

- [ ] Write characterization tests for project-detail loading, guest redirect, retry, disconnect confirmation, environment provisioning, repository installation selection, usage display, and workspace tabs.
- [ ] Move `useParams`, session checks, `useRouter` redirect effects, logout handlers, and component-local command state out of `ProjectDetailView` into `useProjectDetailViewModel` or a dedicated nested project VM.
- [ ] Change `projects/data/projects-repository.ts` to map raw overview/catalog/workspace responses to feature `ProjectOverview`, `ProjectEnvironment`, and `ProjectWorkspace` types. `projects/model` must no longer re-export `lib/api/contracts` types or reference `ApiError`.
- [ ] Preserve confirmation requirements and destructive-delete request payloads exactly, including `deleteGithubRepo` and repository-name confirmation.
- [ ] Run project model/VM/view tests, the relevant E2E route, then the full architecture checks before each project commit.

### Task 8: Migrate workflows, home, teams, settings, guide, and admin by owner

**Files:**
- Move: `src/components/product/{workflow-builder,workflow-builder-utils,workflow-current-tab,workflow-setup-tab,workflow-studio-tabs,generating-overlay,deployment-provisioning-setup,setup-result-panel}.tsx` into `features/workflows/studio/{views,view-models,data,model}/`
- Move: `src/hooks/{use-create-project-form,use-deployment-provisioning-form,use-github-installations,use-project-options-catalog,use-provisioned-projects,use-provider-connections,use-workflow-catalog,use-workflow-history,use-onboarding-tour,use-current-projects-tour}.ts` into `features/workflows/studio/view-models/`
- Move: `src/lib/onboarding/{create-project-tour,current-projects-tour}.ts` into `features/workflows/studio/views/tours/`
- Move: `src/components/product/welcome-modal.tsx` into `features/home/dashboard/views/`
- Move: `src/components/product/group-workspace-panel.tsx` into `features/teams/detail/views/`
- Move: `src/components/settings/workspace-members-section.tsx` into `features/settings/account/views/`
- Move: `src/components/product/flow-explainer.tsx` into `features/guide/overview/views/`
- Move: `src/components/admin/{admin-gate,admin-header}.tsx` into `features/admin/`
- Modify: `src/features/runs/list/**` and `src/features/notifications/inbox/**` to move their session, router, navigation, and workspace-provider orchestration from views into VMs
- Modify: the corresponding feature models, data repositories, VMs, views, barrels, and tests

**Consumes:** prior shared, auth, and workspace boundaries.

**Produces:** No domain UI remains in `src/components`, and every moved action exposes its public view from a barrel.

- [ ] Work one domain at a time and start with a test that fixes the current behavior: Workflow Studio setup/save/history/project creation/provider connection/tour replay, home welcome-modal behavior, team workspace selection, settings member mutation, guide guest rendering, and admin access gating.
- [ ] For each domain, relocate API calls to `data/`, map raw API contracts there, and replace direct hook/API use in JSX with a VM command/result contract.
- [ ] Make `useWorkflowStudioViewModel` the owner of the current WorkflowBuilder's tab query state, project-create/discover/setup/generate commands, status banner, catalog/history/project/provisioning state, and tour commands. Its child tab views receive props and callbacks only.
- [ ] Move every remaining `useRouter`, `useParams`, and `useSearchParams` call from a feature view into that feature's VM; preserve `next/link` in views as render-only navigation.
- [ ] Keep `useRunsListViewModel` as the owner of URL query filtering, but add or expand a runs-page VM to own session/redirect/sign-out state. Give Notifications Inbox the equivalent VM-owned session/router/workspace contract. Preserve the runs Suspense fallback and every current guest/redirect outcome.
- [ ] Run the domain test group, then `npm run typecheck`, `npm run boundaries`, and `npm run arch:check` after each domain commit.

### Task 9: Complete transport, DTO, error, and helper isolation

**Files:**
- Move: generic transport from `src/lib/api/request.ts` to `src/shared/api/`
- Move: each domain API module under `src/lib/api/` into its owning feature `data/` folder; remove `src/lib/api/client.ts` and `src/lib/api/contracts.ts` after their consumers move
- Move: `src/lib/auth/subscription.ts` to `src/features/auth/session/model/`; `src/lib/hosting/provider-urls.ts` to `src/features/projects/detail/model/`; onboarding helpers to `features/workflows/studio/views/tours/`; `src/lib/navigation.ts` to `features/workflows/studio/view-models/` unless a second independent domain consumes it
- Modify: every `src/features/**/model/**/*.ts` importing `@/lib/api/**`, owning `data/` repositories, affected VMs, and model tests under `tests/unit/features/**/model/`

**Consumes:** data repositories and feature ownership established in Tasks 4–8.

**Produces:** Feature models are pure and feature-stable; transport details never escape `data/`; `shared/api` contains only generic transport.

- [ ] For each model-level API import, define the exact domain type in `model/` and a mapper in the owning `data/` module. Preserve optionality, enum/string values, and ordering from the current UI contract.
- [ ] Replace `instanceof ApiError` rules in models with data/VM error classifiers that return safe feature error values. Keep pure presentation rules in model functions that accept plain feature types.
- [ ] Move raw API request functions and DTO declarations beside the repositories that consume them. A feature repository may import `@/shared/api/request`, but no feature model/view/view-model may import it.
- [ ] Move every remaining domain-specific `src/lib` helper to the exact owner above; use `rg` and dependency-cruiser to prove whether `navigation.ts` qualifies for `shared/lib` or belongs in a feature before moving it.
- [ ] Add model tests for each mapper-sensitive rule and repository tests for DTO-to-model conversion, including missing optional fields and 404/error mapping where the current UI distinguishes it.
- [ ] Run the full unit suite, typecheck, and an `rg --files src/lib` inventory showing only permitted shared helpers before committing `refactor(data): isolate transport and feature contracts`.

### Task 10: Enforce the end state and remove legacy roots

**Files:**
- Modify: `scripts/check-boundaries.mjs`, `.dependency-cruiser.cjs`, `src/features/README.md`, `CLAUDE.md`
- Delete: empty `src/components/` and `src/hooks/` directories
- Delete: emptied domain-specific `src/lib/api/`, `src/lib/auth/`, `src/lib/hosting/`, and `src/lib/onboarding/` directories
- Modify: `package.json` only if a CSS warning count is reduced during moved-style cleanup
- Test: `tests/unit/architecture/feature-mvvm-boundaries.test.ts`

**Consumes:** all migration tasks and a clean import graph.

**Produces:** CI prevents recurrence of the legacy architecture.

- [ ] Promote Task 1's legacy API-import inventory to an error: non-feature `app` files, `shared`, any reintroduced `components`/`hooks` source, and feature views cannot import domain APIs or contain feature orchestration.
- [ ] Add dependency-cruiser rules that forbid imports into removed legacy roots and forbid a feature `views/` module from runtime-importing API/data modules.
- [ ] Remove legacy roots and domain-specific `src/lib` folders only after an import inventory confirms that every source import resolves through a feature barrel, a feature-local module, or an allowed `shared/**` module.
- [ ] Run the complete local gate in repository order: `npm run typecheck`, `npm run lint`, `npm run lint:css`, `npm run boundaries`, `npm run arch:check`, `npm test`, and `npm run build`.
- [ ] Compare route URLs, API request snapshots, and CSS selector/declaration multisets against the characterization baseline; resolve any difference as a regression before final commit.
- [ ] Commit with `refactor(architecture): enforce feature mvvm boundaries`.

## Delivery Sequence

Execute Tasks 1–5 first, then Task 6 (groups), Task 7 (projects), Task 8 (one domain per commit), Task 9, and Task 10. Each unit can be reviewed and released independently; no behavior change may be bundled into these commits. The persistent-platform-layout idea is a separately specified follow-on, not a task in this plan.
