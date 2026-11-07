# AlphaCI feature origins, edition assignments, and personas

Investigation date: November 5, 2026. Historical product snapshot: `214ef9ba6d4b61b7bd85f930fce8a90e7d9f488d`.

Implementation follow-up: the local branch validates edition authoring, supports a no-write preview and generates a [built feature inventory](../../capabilities/feature-inventory.generated.md). It also separates default-on governance and managed-host controls while preserving all existing edition memberships, and adds operator composition diagnostics. The historical observations below remain tied to the investigation snapshot; the [capability contract](../../capabilities/capability-contract.md) records current local behavior. See the [legacy reconciliation](legacy-reconciliation.md) for EDU prototype and branch-only SaaS evidence.

This report records an investigation snapshot and proposals; subsequent local implementation is described above. No database, deployed configuration or remote repository was changed. The accompanying [interactive map](feature-map.html) separates feature origins, current local catalog declarations, and proposed commercial assignments. Run `node docs/plans/golden-copy-persona-map/refresh-map.cjs` from the repository root to refresh its catalog snapshot.

## What the history explains

The catalog alone understates the product. AlphaCI grew from SaaS roots, went through an internal operating transition, accumulated Enterprise changes, was renamed Golden Copy, and then became the monorepo. Education also has a separate historical application line.

Recent work is often present in code but grouped under older, broader capability names. That differs from code that exists only on another branch, and from an old product that has not been ported. Those cases need separate treatment before any edition reassignment.

The current catalog source last changed on September 25. Substantial requirements, persona, host-delivery, self-hosting, and release work continued in October. This supports the concern that the catalog is an incomplete feature inventory. It does not prove every Enterprise-origin feature was intended to be Enterprise-exclusive.

## Verified repository lineage

| Period | Evidence | Interpretation |
|---|---|---|
| April–May | Imported frontend history begins April 17; another imported root begins May 16. Older `alphaci-fe` shares the frontend's original commit identity with the pre-import Golden Copy frontend. | Shared historical roots. A new repository creation date does not identify when each feature was first written. |
| July 3 | [Internal transition commit](https://github.com/Alpha-Explora/alphaci/commit/9e7d7ba7887169ab9cac78c91bf83d9380e0ef33). | Internal operation predates the later Enterprise and Golden Copy names. |
| July–August | Separate `AlphaCI-Educ-be` and `AlphaCI-Educ-fe` histories. | A school product existed separately. Its features cannot be inferred from today's EDU manifest. |
| August 19 | [API removes payment gateway](https://github.com/Alpha-Explora/alphaci/commit/ed995e2d20b263a72bb200089ac9ee2cb9cc2f1a); [web removes paywall](https://github.com/Alpha-Explora/alphaci/commit/63614630e039711cf8f84418f931ca2a25b73ab2). Both commits explicitly describe contract billing. | The Enterprise-derived line changed product behavior, not merely branding. Restoring a SaaS edition name does not restore checkout. |
| September 15 | Composition resolver, single authoring source, package, ledger, and client policy work enter the preserved history. | The current capability architecture was added to an already substantial product. |
| September 18 | [API rename commit](https://github.com/Alpha-Explora/alphaci/commit/c5fdd6800d20f21be882aeb2bd7c9d65c34320e3) changes provenance from `alphaci-enterprise-be` to `alphaci-golden-copy-be`; [frontend rename](https://github.com/Alpha-Explora/alphaci/commit/43868c2c47a414f126bc5028e0912f00d8cc0ca0) explicitly says renamed from `alphaci-enterprise-fe`. | Enterprise became Golden Copy through a repository rename. They are not unrelated greenfield products. |
| September 25 | [Last capability-source change](https://github.com/Alpha-Explora/alphaci/commit/db8b85bb83044dbf470c1f6f882088b58531a605): QA checklist definitions and sharing. | The catalog's vocabulary stops expanding before major October work. |
| October 14–21 | [Signed host delivery](https://github.com/Alpha-Explora/alphaci/commit/8f43299315b847af14aa4a993a3f33de88e3baeb), [appliance](https://github.com/Alpha-Explora/alphaci/commit/4f292c1449df8c09ecd18bcd7ebc53bc39abb95d), [PO acceptance](https://github.com/Alpha-Explora/alphaci/commit/3c9820c24ab41fd89e0e5c4d268f5ab3595c3db1). | Substantial built behavior has no corresponding new, specific capability keys. |
| November 1 | [Monorepo start](https://github.com/Alpha-Explora/alphaci/commit/34fbcf3e6176e5bb07d81881234d0238e57dc44a), [backend import](https://github.com/Alpha-Explora/alphaci/commit/9f78bf0e4dbfdd0c864e9c049900ee760e0e8203), [frontend import](https://github.com/Alpha-Explora/alphaci/commit/411b359c86c011ba16e0831ae510fb31eb540366). | Both old Git histories are retained. The monorepo is a consolidation of the Golden Copy application. |

The imports rewrote paths and commit identities. Historical checkout hashes and monorepo hashes can differ for the same change. The links above use commits that exist in this monorepo.

### Organization inventory checked live

GitHub connector searches and repository metadata confirmed these Alpha-Explora repositories on November 5. Latest default-branch commit results also matched the inspected local histories for the seven application repositories below. The compact live-query snapshot is preserved in [repository evidence](repository-evidence.json).

| Repository | Live status / observed default-branch tip | Role |
|---|---|---|
| [alphaci](https://github.com/Alpha-Explora/alphaci) | Public, active; `214ef9ba` | Current monorepo |
| [alphaci-golden-copy-be](https://github.com/Alpha-Explora/alphaci-golden-copy-be) | Public, archived; `b65a63f3` | Pre-monorepo API |
| [alphaci-golden-copy-fe](https://github.com/Alpha-Explora/alphaci-golden-copy-fe) | Public, archived; `993479d7` | Pre-monorepo web |
| [alphaci-be](https://github.com/Alpha-Explora/alphaci-be) | Private, active; `4a5fb6c4` | Older SaaS/internal backend line |
| [alphaci-fe](https://github.com/Alpha-Explora/alphaci-fe) | Private, active; `fc18558d` | Older SaaS/internal frontend line |
| [AlphaCI-Educ-be](https://github.com/Alpha-Explora/AlphaCI-Educ-be) | Private, active; `2fe9dffa` | Separate education backend |
| [AlphaCI-Educ-fe](https://github.com/Alpha-Explora/AlphaCI-Educ-fe) | Public, active; `5aac58da` | Separate education frontend |

Related repositories discovered: `alphaci-workflow`, `alphaci-educ-workflow`, `AlphaCI-Educ-lab-ext`, `AlphaCI-Docs`, archived `alphaci-legacy`, and smoke/demo repositories. Discovery does not constitute a source audit of these related repositories. Enterprise-named repositories were not returned by the organization search; the historical rename commits explain the main application names.

The local Enterprise backend folder is a linked worktree of the Golden Copy backend repository. Its `codex/docs-multi-deployment-db-isolation` branch ends at `0ed3e848`. That tip is not an ancestor of Golden Copy backend main `b65a63f3`. It contains additional SaaS self-serve-auth and tenancy work that must be treated as branch work, not a feature lost during the monorepo import. The local Enterprise frontend directory is empty, so its history was recovered from the preserved import instead.

## What is built and how it is assigned today

| Behavior | Current evidence and assignment | Gap |
|---|---|---|
| Requirements, test cases, Project QA runs, PO acceptance, iterations, promotion gate | `qa-requirements.controller.ts:43`, `qa-project-runs.controller.ts:50`, and `qa-runs.controller.ts:291` require `projects.qa-checklists`. That key belongs to SaaS, EDU, and Enterprise. | The key's description still says “QA checklist definitions and per-project sharing.” It understates the delivery workflow. No independent approval or iteration entitlement exists. |
| On-prem host inventory, enrollment, assignment, readiness | Runtime host and assignment controllers require shared `runtime.env-provisioning`: `onprem-hosts.controller.ts:19`, `onprem-assignments.controller.ts:32`, `onprem-readiness.controller.ts:16`. | `catalog.source.json:366` lists only workflows/projects domains and routes; `/hosts` and its feature barrel are missing. A user sees a host product that the capability map barely describes. |
| Signed releases and environment deployment | `environment-releases.controller.ts:24` and `project-releases.controller.ts:11` use `runtime.env-provisioning`; machine CI/agent callbacks have separate token-based authorization. | Broad shared provisioning key. A future host-delivery entitlement must cover the machine paths as well as browser controllers. |
| Single-server AlphaCI appliance | `deploy/selfhost` and `deployment-mode.ts:10` implement the `selfhosted` deployment contract. | Deployment support is not proof of air-gap readiness or the separately declared `runtime.customer-isolation` capability. |
| Role dashboards and workflow responsibilities | Global `app_role` rules in `persona-access.rules.ts:29`; QA action rules in `qa-run-access.rules.ts:31`. | A capability-only matrix cannot explain which user can perform an action. |
| Workspace notifications | `platform.notifications`, shared across all editions; October adds live membership notifications. | Behavior expanded without a new capability key. This is a reasonable shared capability, but a feature index should name the new behavior. |
| Enterprise customer policy | `runtime.client-composition`, Enterprise only; `SingleClientPolicySource.for()` ignores the subject and returns one deployment policy. | Customer-specific deployment narrowing exists; tenant-specific edition selection does not. |
| Public marketing pages | `apps/web/src/app/page.tsx:1` loads the public-site feature when `PUBLIC_SITE_ENABLED`; `shared/composition/build-profile.ts:48` enables it for the SaaS build edition. | Actual landing UI exists while the `platform.public-site` catalog record is `not-implemented`. This is a maturity/meaning mismatch, not evidence that no marketing UI was built. |
| Self-serve payment | Removed from this line in August; catalog `billing.checkout` remains unimplemented. | A SaaS manifest entry does not restore the removed payment flow. |

API paths in this table are under `apps/api/src/modules/`; rules are under `apps/api/src/kernel/rules/` unless named otherwise. Catalog source is `apps/api/src/kernel/composition/catalog.source.json`.

### Education has a separate migration gap

The historical education application contains student and teacher accounts, school-domain signup, classes and join codes, individual and group assignments, repository provisioning, CI runs, submissions, hidden tests, grading, reports, school administration, and lab operations. Its frontend has teacher, student, admin, and super-admin route areas.

The old backend README calls its main-branch runtime a prototype with seeded in-memory data and optional persistence. Some later lab and pipeline work is on `workflow-educ`, whose backend tip is not an ancestor of backend main in the inspected refs. Presence in that branch is not proof of merged or production-ready behavior.

The current monorepo has no equivalent school/course/class/assignment API modules. Its EDU-only keys are LMS/LTI, cohort policy, education identity provisioning, and FERPA workflows, all unimplemented. Those labels neither describe the whole historical school product nor prove it was integrated. The education marketing section is also not school workflow implementation.

A migration decision must classify each old journey as reuse, port, redesign, or retirement. Student and teacher personas need a deliberate current identity model; do not silently map a student to Developer and a teacher to Product owner.

## The current composition model

The [authoring source](../../../apps/api/src/kernel/composition/catalog.source.json) contains 32 catalog records. Counts below describe metadata, not independently verified features or screens.

| Edition | Stable | Limited | Not implemented | Declared total |
|---|---:|---:|---:|---:|
| SaaS | 7 | 11 | 3 | 21 |
| EDU | 7 | 11 | 5 | 23 |
| Enterprise | 7 | 12 | 7 | 26 |

All three editions share 18 implemented catalog records. Enterprise adds `runtime.client-composition`. Configuration flags, dependencies, provider readiness, billing, and authorization can further restrict behavior. “Stable” is the catalog's maturity claim; it does not mean enabled on a particular running deployment.

The SaaS-specific declarations `platform.public-site` and `billing.checkout` are unimplemented in catalog terms. EDU adds four unimplemented declarations. Enterprise adds six unimplemented declarations: SSO/SCIM, data residency, managed secrets, air-gap packaging, customer isolation, and GitHub Enterprise Server. All three include unimplemented runtime edition-entitlement resolution.

These are independent decisions:

| Axis | Current implementation |
|---|---|
| Product edition | `saas`, `edu`, `enterprise`; `capability-types.ts:4` |
| Build profile | `hosted` includes SaaS and EDU; `enterprise` includes Enterprise; `build-profile.ts:43` |
| Deployment mode | `saas`, `selfhosted`; `kernel/config/deployment-mode.ts:10` |
| Product capability | Catalog membership, maturity, flags, dependencies, client deny policy |
| User persona | `member`, `qa`, `lead`, `admin`; action and resource rules |
| Organization/internal policy | Sign-in membership and billing exemptions; does not select a manifest |

At startup, the API chooses an edition manifest. Client policy can only deny entries. The resolver removes unimplemented records, records with false or missing flags, and records with missing dependencies. `CapabilityGuard` returns 404 when required composition is absent; subscription checks are separate, and user action checks can return 403. A route with no capability metadata is allowed by the capability guard; the route-coverage architecture test therefore requires an explicit gate or a documented exception. It does not make every existing route edition-gated.

The request resolver accepts a tenant subject, but the current client policy source ignores it. `/capabilities` reports deployment composition. Mixed SaaS/EDU tenants in one running API are not a completed capability of this implementation.

### Internal is an operating overlay

`github.internalOrg` can restrict login to organization members. `isInternal` bypasses subscriptions (`subscription.service.ts:25`), while usage quotas consult the stored internal flag. In self-hosted mode, the organization defaults to the customer's enforced organization (`app.config-slices.ts:101`). Consequently, “internal” can mean a customer's members as well as company employees. It does not mean platform administrator, and it does not unlock absent capabilities.

Recommend an explicit internal deployment preset that chooses a base edition, organization policy, provider settings, workflow ref, and billing treatment. If staff-only product behavior is needed, define an explicit audience policy for it. Do not use the current billing-oriented flag as a general employee-only entitlement.

## Proposed tier assignments

The user requested origin plus proposed assignments. These are recommendations for review; no access changes were made.

| Behavior | Proposal | Reason / work needed |
|---|---|---|
| Projects, repositories, CI history, ordinary hosted environments, basic notifications, hierarchy | Shared SaaS, EDU, Enterprise | Common foundation already shared. Use explicit quotas where appropriate. |
| Requirements, test cases, basic QA execution and feedback | Shared foundation, with EDU terminology and school workflows designed separately | These actions support every delivery team. Historical school roles are not current personas. |
| Controlled production approval, PO acceptance, iteration delivery policy | Enterprise governance capability; optional institutional EDU agreement | Candidate split of existing `projects.qa-checklists`, not merely a renamed manifest row. Define independent behavior and test what still works when governance is excluded. Keep mandatory safety gates where the shared workflow depends on them. |
| Managed customer hosts, agent enrollment, signed release delivery, host fleet operation | Enterprise; explicit institutional EDU add-on if required | Distinct operating and support obligations. Consider a new provider-neutral capability such as `runtime.managed-host-delivery` only when it defines an independently enforceable product boundary. |
| Self-hosted AlphaCI appliance distribution | Enterprise distribution; institutional EDU by agreement | Preserve deployment mode as a separate technical axis. Do not use it as a proxy for every feature entitlement. |
| Client-specific deny policy | Enterprise | Already represented and enforced at deployment composition. |
| LMS/LTI, school cohorts, classes, assignments, grading, lab operations | EDU product roadmap | Recover legacy journeys and implementation limits before porting. Keep shared repository/runtime infrastructure underneath. |
| Public landing site and eventual self-serve onboarding/payment | SaaS | Reconcile existing landing-page maturity. Checkout and historical unmerged auth require separate implementation decisions. |
| Internal staff use | Base edition plus internal preset and normal personas | Do not fork business logic or grant admin through internal membership. |
| SSO/SCIM, data-location controls, managed secret backend, air-gap, GHES | Enterprise roadmap; still unavailable until implemented and verified | Declared promises are not current product readiness. |

## How to add and assign a feature

First decide whether the change is a behavior inside an existing capability or a genuinely independent entitlement. A new screen or action does not automatically need a new catalog key. Add a feature-level inventory entry when the existing capability remains the correct boundary.

For a new boundary, define the owning API context, editions, maturity, configuration flag, dependencies, API routes, UI feature barrels, and permitted user actions. Implement the behavior and its checks in the owning domain. UI views consume returned permissions; the API must enforce the action and resource policy.

The current metadata scaffolder can start a declared feature with:

```powershell
npm run capability:new -w @alphaci/api -- --key projects.release-approval --description "Controlled production approval." --editions enterprise --summary "Declare the production approval capability."
```

This example is illustrative and was not executed. The command defaults to `not-implemented`; it does not create working behavior. For an implemented feature, set `--maturity`, `--configuration`, `--flags`, and the actual `--requires`, `--api-field`, `--view-flag`, `--domains`, `--routes`, `--barrels`, and `--artifact-symbols` values as appropriate. A flag in metadata must exist in AppConfig and be mapped from real configuration. Optional providers need separate readiness checks.

The command writes the source record, generates registry and manifests, packages the catalog, records the ledger, and refreshes web maps and pack profiles. Do not hand-edit generated registry, manifests, package artifacts, generated maps, or pack profiles.

For an existing capability, edit `editions` in `catalog.source.json`, preserving canonical `saas`, `edu`, `enterprise` order. Generate composition and package, append a `membership-changed` ledger entry with a reason and reference, then regenerate web maps:

```powershell
npm run generate:composition -w @alphaci/api
npm run package:capability-catalog -w @alphaci/api
npm run ledger:record -w @alphaci/api -- --change membership-changed --keys projects.example --summary "Explain the membership decision." --reference CHANGELOG.md
npm run generate:architecture-maps -w @alphaci/web
```

Use the real existing key and reference. `ledger:record` also refreshes API maps. Update the relevant current-state concept and `docs/log.md` when a contract changes. Add the required root changelog line for a user-visible change.

Assign personas separately in backend role/domain rules. The catalog has no `allowedRoles` field. Add `@RequiresCapability(...)` and `CapabilityGuard` to product HTTP boundaries, with auth before composition and subscription afterward. Verify alternate endpoints, workers, machine callbacks, and replay paths according to the feature's actual flows. Background workers use deployment composition rather than inheriting request scope automatically.

Verify included and excluded editions, allowed and denied personas, resource scoping, disabled flags, dependency removal, and relevant provider behavior. Run API capability/source/package/ledger/profile checks, web surface/profile checks, meaningful behavior tests, and root `npm run check:documentation`. Build-artifact exclusion needs its profile builds; a green metadata check is not proof that implementation code was excluded from an image.

## Improvements in order

1. Reconcile the feature inventory before changing eligibility. Add named behaviors below existing capabilities, including origin commit, current route, owning context, persona actions, and current versus proposed membership. Expand stale QA descriptions and add `/hosts` to the appropriate metadata. Generate views from that inventory and the existing catalog rather than maintaining another entitlement registry.
2. Reject unknown and empty edition assignments. `new-capability.cjs:60–85` filters unknown strings through `EDITIONS`, and `composition-source.cjs:98–105` accepts an empty array. An in-memory reproduction with `internal` produced `editions: []` and no validation errors. Reject both unknown tokens and zero resulting memberships before any file is written.
3. Review the proposed Enterprise boundaries. Split managed-host delivery and governance only if each has coherent included and excluded behavior. Do not remove broad provisioning or QA keys to achieve a narrower product distinction; that would also remove shared behavior.
4. Reconcile the EDU and unmerged SaaS branches as separate migration work. Record what is integrated, branch-only, prototype-only, replaced, and deliberately retired. Do not count old source as current functionality.
5. Add composition explanations for operators. Report why a capability is absent: edition, maturity, client deny, flag, dependency, or provider readiness. Keep diagnostic details separate from public denial responses.
6. Add tenant-specific composition only if a real mixed-tenant requirement exists. Implement the manifest/policy source, align subject-aware capability advertisement with request enforcement, and test tenant isolation before claiming per-tenant tiers.

## Verification and limits

- Verified live organization discovery, repository status, and latest default-branch commit results with GitHub connected tools. Inspected local immutable refs and retained monorepo history. No fetch, checkout, commit, push, PR, or remote mutation was performed after creating the requested worktree.
- Recomputed all edition counts from the canonical source. The artifact refresh validates source records with the repository's actual source validator.
- `node apps/api/scripts/check-capability-package.cjs` passed, including provenance and canonical artifact integrity.
- Confirmed invalid-edition behavior by invoking the real validator on an in-memory document, without running the mutating scaffolder.
- Initial checks were blocked by missing dependency resolution. During the documentation follow-up, the existing main-checkout dependency installation was reused through process-local `NODE_PATH` and `PATH`, with ignored local workspace junctions pointing to this checkout's packages. The borrowed catalog was first checked byte-for-byte against this checkout. No dependencies were installed and the other checkout was not edited.
- The follow-up root `npm run check:documentation` passed: the OKF bundle, links, current-state policy, changelog, generated maps, API composition source, registry, ledger, and web surfaces all passed. Turbo reported two successful tasks and no cache hits. Runtime and provider checks remain outside this result.
- The visual checks its edition inheritance, 32 rows, tab switching, and assignment interaction in the renderer. Desktop and narrow layouts were inspected with HTML preview.
- Application runtime, real providers, deployed images, databases, historical deployments, and production readiness were not tested. Historical code and commit titles support provenance, not commercial approval or readiness.
- Existing changes in all other checkouts were preserved. The untracked web AGENTS guidance in the original checkout was read; no Next.js application code was written.
