# @alphaci/api-contracts

HTTP wire types shared by the API (`apps/api`) and the web app (`apps/web`).
The API's code uses them for the responses it sends and the web app imports
the same definitions for what it reads. When the API changes a shape in a way
that breaks the web app, the web typecheck fails in the same pull request.

| File                       | Covers                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/deployments.ts`       | `GET /projects/:id/deployments`: `DeploymentHistoryResponse`, `DeploymentHistoryItem`, `DeploymentHistoryStatus`, `DeploymentHistoryMode`, and the `DeploymentProvider` / `DeploymentSlot` vocabulary                                                                                                                              |
| `src/previews.ts`          | `GET /projects/:id/previews`: `ProjectPreviewsResponse`, `ProjectBranchPreview`, `ProjectBranchPreviewStatus`, `ProjectPreviewDeploy`, `PreviewSurface`                                                                                                                                                                            |
| `src/drift.ts`             | `GET /projects/:id/drift`, `POST .../drift/run`, `POST .../drift/:findingId/repair`: `DeploymentDriftResponse`, `DeploymentDriftFinding` and its severity, status and source, `ProjectDriftRepairAction`, `ProjectDriftRepairResponse`                                                                                             |
| `src/env-vars.ts`          | `GET /projects/:id/env-vars`, `POST .../env-vars/provision`, `POST .../env-vars/validate`, `DELETE .../env-vars/:metadataId`: `EnvVarMetadata` and its `EnvVarProvisionStatus`, `EnvLane`, `EnvVarScope`, `EnvVarInput`, `ProvisionEnvVarsRequest`/`Response`, `ValidateEnvVarsRequest`/`Response`, `DeleteEnvVarMetadataResponse` |
| `src/groups.ts`            | `GET`/`POST /groups`, `GET`/`PATCH /groups/:groupId`, `POST .../archive`, `POST .../reopen`, `GET .../members`: `Group` (with the caller's `role` on every response), `GroupMember`, and the `GroupRole`, `LifecycleStatus`, `MemberStatus`, `MemberAppRole` vocabulary                                                            |
| `src/delivery-projects.ts` | `GET`/`PATCH /delivery-projects/:deliveryProjectId`, `POST .../archive`, `GET`/`POST /systems/:systemId/delivery-projects`: `DeliveryProject`                                                                                                                                                                                      |
| `src/domains.ts`           | `GET`/`POST /projects/:id/domains`, `POST .../domains/:domainId/verify`, `DELETE .../domains/:domainId`: `CustomDomain`, `DomainVerificationChallenge`, `AddCustomDomainRequest`, `RemoveCustomDomainResponse`                                                                                                                     |
| `src/project-todos.ts`     | `GET`/`POST /delivery-projects/:id/todos`, `PATCH .../todos/:todoId`: `ProjectTodo`, `ProjectTodoList`, `TodoPerson`, and the `BacklogPriority` / `ProjectTodoStatus` vocabulary                                                                                                                                                   |
| `src/qa-history.ts`        | `GET /delivery-projects/:id/qa-history`: `QaHistoryPage`, `QaHistoryEvent`                                                                                                                                                                                                                                                         |
| `src/semantic-coverage.ts` | `GET /delivery-projects/:id/semantic-coverage`: `ProjectSemanticCoverage`, `StoryCoverage`, `CriterionCoverage`, `CoverageSummary` and their statuses                                                                                                                                                                              |
| `src/qa-imports.ts`        | `POST /delivery-projects/:id/qa-import-preview`: `QaImportPreviewResponse`, `ImportSheet`                                                                                                                                                                                                                                          |
| `src/special-access.ts`    | `PATCH /admin/users/:id/special-access`: `SpecialAccessResponse`, `SpecialAccess`                                                                                                                                                                                                                                                  |

`DeploymentProvider` is an open `string`, not a list: providers are runtime
plugins (`render`, `vercel`, `onprem-compose`, `gcp`, ...). Every `provider`
field here uses it, so a client that labels providers needs a fallback for an
id it does not know.

## Checking a contract against the API

A type is not proof the API sends it. For each declared route there is a Zod
schema in `apps/api/tests/e2e/support/contracts/` and a line in `ROUTE_CONTRACTS`
(`routes.ts`). `hierarchy-contracts.e2e-spec.ts` calls the real routes and checks
each response with `strictObject`, so a field the API stops sending, renames or
adds fails the suite. A compile-time `Matches<Schema, Type>` check fails when the
schema and the type here stop describing the same shape. The schemas live in the
API's tests, not in this package, so the package stays types only.

`tests/architecture/route-contracts.spec.ts` requires every route in the route
inventory to be in `ROUTE_CONTRACTS` or in `route-contracts.baseline.txt`, the
routes that have no contract yet. A new route therefore declares one, or shows up
in the review as a baseline line. To declare one: add the type here, the schema
and the `ROUTE_CONTRACTS` entry, cover the route in an e2e spec, then regenerate
the baseline with `UPDATE_ROUTE_CONTRACTS_BASELINE=1 npm test -w @alphaci/api --
route-contracts`.

## Rules

- **Types only.** Write only `export type` and `export interface`. Use
  string-literal unions, not `enum` or `const`. `src/index.ts` re-exports
  with `export type *`, so a value cannot get through even by accident. The
  package has no build step and no runtime entry point: `exports` has a
  `types` condition only, so a value import fails to resolve instead of
  shipping. Neither app loads it at runtime, and the API lists it as a
  devDependency.
- **Consumers use `import type`.** The API's lint rule
  `consistent-type-imports` already requires it, and ts-jest and SWC erase
  type-only imports.
- **The API's shape wins.** A type belongs here only when it is exactly what
  the API sends. If the web app expects something else, the web app is wrong:
  fix the type here to match the API and fix the web consumers. Never change
  an HTTP response to fit a type.
- **Plain TypeScript.** Use no path aliases and import nothing from either
  app. Use relative imports with a `.js` extension (`./deployments.js`): that
  form resolves under the API's `nodenext` and the web app's `bundler`
  resolution.

## Where each side imports it

- **API:** the file that already owned the shape re-exports it. Drift and
  deployment history go through `src/kernel/ports/deployment-runtime.port.ts`.
  Previews go through
  `src/modules/projects/application/dashboard/project-previews.types.ts`.
  `PreviewSurface` goes through `src/modules/projects/domain/preview-surface.rule.ts`.
  Env vars and domains go through `src/modules/runtime/core/deployments.types.ts`
  (`CustomDomain` under the API name `CustomDomainSummary`), and
  `EnvVarMetadata` through the kernel port too. The request and response
  types go through the files that declared them:
  `src/modules/runtime/api/dto/provision-env-vars.dto.ts`
  (`ProvisionEnvVarsDto`), `application/env-vars.service.ts`
  (`ValidateEnvTextInput`, `ValidateEnvTextResponse`) and
  `application/custom-domains.service.ts` (`AddCustomDomainInput`); the
  services' return types name the package's response types.
  The rest of the API keeps importing from those files.
- **Groups and Projects:** the repository files own the records
  (`GroupRecord` is a `Group` before the caller's role is added;
  `GroupMemberRecord` and `DeliveryProjectRecord` are the package types), and
  `GroupsService` returns `Group`.
- **Web:** `src/shared/api/contracts.ts` is the only file that imports the
  package; the web `boundaries` rule `api-contracts-through-shared-api`
  enforces this. It re-exports each type, under the web's existing name where
  that name differs (`ProjectDeploymentHistoryItem` is `DeploymentHistoryItem`,
  `ProjectDriftFinding` is `DeploymentDriftFinding`, `EnvTargetSlot` is
  `DeploymentSlot`, and so on).
- **Names.** A type keeps the API's name when that name describes the wire
  shape (`DeploymentHistoryItem`). Where the API's name was internal (a
  `*Dto`, `*Input` or `*Summary`, or an inline return type), the package uses
  the web's `*Request` / `*Response` name and the API aliases it.
- **Provider choices stay in the web.** The web's `CreatableEnvProvider`
  (`"render" | "vercel"`) is the fixed list the UI offers when the user picks
  a provider. It lives in `contracts.ts`, is not a wire type, and does not
  belong here.

## Adding a type

1. Find what the API actually returns: the service method's return type, the
   kernel port, or the module's `*.types.ts`. Do not copy the web's version.
2. Compare it field by field with the web's version in
   `apps/web/src/shared/api/contracts.ts`. Note each difference in the pull
   request; the API's version wins.
3. Move the definition into the domain file here, adding a new file if no
   domain file fits, and export it from `src/index.ts`.
4. In the API, replace the local definition with
   `export type { … } from '@alphaci/api-contracts'` where it was defined.
5. In the web app, delete the hand-written copy from `contracts.ts`, re-export
   it from the package, and fix every consumer the typecheck flags.
6. Run `npx turbo run typecheck lint --filter=@alphaci/api --filter=@alphaci/web`.

A change here marks both apps as affected (`turbo.json` lists the package in
`globalDependencies`, and both apps depend on it).
