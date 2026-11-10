# @alphaci/persona-rules

Who may do what, by global app role (`admin`, `lead` = Product owner, `qa`,
`member` = Developer). The API enforces these rules and answers 403 when one
fails; the web app calls the same functions to decide which controls to offer.
Before this package each side kept its own list, and the web comments read
"mirrors the backend; keep the two in step".

| Export                                                                                      | Rule                                                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `canManageProjectLifecycle`                                                                 | reinstall CI secrets, disconnect a project: admin, lead                                                            |
| `canManageEnvVars`, `canManageHosting`                                                      | environment variables, deployment targets, custom domains: admin, member                                           |
| `canManageRequirements`                                                                     | create or edit a Project's requirements: admin, lead                                                               |
| `canCreateProjectFolder`                                                                    | create a Project: admin, lead                                                                                      |
| `canCreateRepository`, `repositoryCreateRequiresProject`                                    | create or onboard a repository, and whether it must name a Project: admin, member; only admin may omit the Project |
| `isPullRequestRole`, `isAllowedPullRequestRoute`                                            | open or merge a workspace pull request, by `head` and `base`; nothing into production                              |
| `PIPELINE_BRANCHES`, `WORKING_BRANCH`, `QA_BRANCH`, `PRODUCTION_BRANCH`, `isPipelineBranch` | the promotion flow `dev` > `uat` > `main` that the route rule reads                                                |

## Rules

- **Pure and allow-list only.** Plain data in, boolean out; no I/O, no
  framework. A role added later, or a session whose role has not loaded (`null`,
  `undefined`), is refused until a list names it.
- **Plain CommonJS plus a hand-written `index.d.ts`**, like
  `@alphaci/capability-catalog`: neither app needs a build step to load it. The
  test checks that `index.d.ts` declares exactly what `index.js` exports.
- **Both apps list it under `dependencies`**, and both Dockerfiles copy the
  folder into the runtime image, because the API requires it at runtime.
- **A rule goes here when both sides need it.** A rule only the API needs (for
  example `canBeAssignedRepository`) stays in `apps/api/src/kernel/rules`; a
  display rule only the web needs stays in its feature `model/`.
- **Change a list here, and its test in `index.test.js`**: the truth table is
  written out role by role, so a changed list shows up as a diff.

`npm test -w @alphaci/persona-rules` runs the tests.
