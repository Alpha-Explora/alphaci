# Monorepo improvements and dependency upgrades

Date: 2026-11-01. Status: proposed. Owner: platform.

This plan covers the eight follow-ups agreed after the Turborepo migration,
the CI speed ideas worth taking from
["How I made our CI 20x faster"](https://x.com/owengretzinger/status/2116291924219060319)
(Owen Gretzinger, 2026-10-30), and every outdated dependency in the
workspace.

## Ground rules

- One pull request per step below. No direct pushes to `main`.
- CI stays on GitHub-hosted runners. No Blacksmith, Depot or self-hosted
  runners for now.
- A step is done when its own checks pass locally and in CI, and the PR
  description says what was verified and how.
- Upgrades never ride along with feature work, and feature work never rides
  along with upgrades.

## CI cost and speed

`alphaci` was private for its first day, which put it on the Free plan's
2,000 Linux minutes a month and 2-vCPU runners. On 2026-11-02 the owner made
it public, like the old `alphaci-golden-copy-be` and `-fe` repos, so Actions
minutes are free again and jobs run on 4-vCPU standard runners. Minutes are
no longer a budget; wall time to a verdict is what matters, because agents
wait on it.

Measured on `main` while private (runs 41320027302 and 41319167296):

| Job | Wall time | Biggest steps |
|-----|-----------|---------------|
| API quality job | 186 s (stopped at Tests) | lint 59 s, tests 72 s, `npm ci` 26 s, typecheck 17 s |
| API end-to-end | 217 s | tests 175 s, `npm ci` 28 s |
| API boundaries | ~60 s | `npm ci`, dependency-cruiser |
| Web job (serial) | 331 s | unit tests 91 s, `npm ci` 85 s, profile builds 82 s, lint 36 s |

Splitting jobs and sharding are now cheap, so step 2 favours parallelism.

## Order

| # | Step | Depends on | Size |
|---|------|------------|------|
| 1 | Get `main` green | — | S |
| 2 | CI on Turborepo: affected-only, caches, parallel jobs, required check | 1 | M |
| 3 | Shared API contracts package | 2 | L |
| 4 | Dependency upgrades and toolchain alignment (waves A–E) | 2 | L |
| 5 | Release workflow for both images | 6 | M |
| 6 | Move `deploy/selfhost` to the root | — | S |
| 7 | Web end-to-end against the real API | 2, 3 | M |
| 8 | Automated dependency updates | 4 (wave A) | S |

Steps 1 and 6 can start immediately. 2 unblocks almost everything else
because it decides how each later PR is checked.

---

## 1. Get `main` green

**Why.** API CI has been red since at least 2026-10-21 (also on the old
backend repo). Nothing can be made a required check while `main` fails.

**The failure.** `tests/architecture/schema-ownership.spec.ts` and
`npm run check:schema-ownership` report one violation:

```
src/modules/projects/infrastructure/qa-project-runs.repository.ts:766:
  env_provisioning.onprem_hosts is outside projects
```

The projects module reads a table owned by the environment-provisioning
side of the runtime module.

**What changes.**
- The query that needs on-prem host data moves behind the owning module's
  public port (or an existing read port is extended), and
  `qa-project-runs.repository.ts` calls that port instead of the table.
- No schema change and no behaviour change; the QA run read returns the same
  rows.

**How.** Read the owning module's `index.ts`/ports first and reuse an
existing read if there is one (`docs/architecture/context-contracts.md`
lists them). Add a focused test on the port. Run
`check:schema-ownership`, `check:application-boundaries`, `boundaries` and
the full API suite.

**Done when.** API CI is green on `main`.

---

## 2. CI on Turborepo

**Why.** Today three path-filtered workflows run every step of an app when
any file in it changes, install dependencies from scratch in every job, and
cannot be required checks (a skipped workflow never reports).

**What changes.**

1. **One workflow, `ci.yml`,** replaces `api-ci.yml`, `api-boundaries.yml`
   and `web-ci.yml`. `onprem-agent-release.yml` stays separate.
2. **Every check becomes a Turborepo task** with declared `inputs`, so
   unchanged work is skipped and cached:
   - shared tasks in `turbo.json`: `lint`, `typecheck`, `test`, `build`,
     `boundaries`, `check:documentation`, `check:capabilities`,
     `check:capability-package`;
   - app-specific checks (`check:schema-ownership`, `arch:check`,
     `lint:css`, `complexity`, profile builds, …) as tasks on that app;
   - the jobs call `turbo run <tasks> --affected` instead of listing steps.
3. **Parallel jobs on one cached install.** A `setup` job restores or builds
   `node_modules` (cache key: lockfile hash + Node version). Then `lint`,
   `typecheck`, `test`, `checks`, `build` and `e2e` run in parallel and
   restore that cache (13 s restore instead of a 26–85 s install, per the
   article's numbers and ours).
4. **Caches seeded from `main`.** GitHub scopes caches to the branch that
   wrote them, and a PR can read caches from its base branch. A push to
   `main` runs the setup job so PRs always find a warm cache. This is the
   bug the article found that "had been there all year".
5. **Blobless checkout** (`filter: blob:none`, full history) instead of
   `fetch-depth: 0`. `--affected` and `arch:check:touched` need history;
   blobless gives it without downloading every file version.
6. **Remote cache** via Vercel Remote Cache when `TURBO_TOKEN` and
   `TURBO_TEAM` are set as repo secrets. Without them, CI uses a local
   `.turbo` cache saved with `actions/cache`. Both work; remote is faster
   across branches.
7. **One required check.** A final `ci-passed` job depends on every other
   job and fails if any failed or was cancelled. Only `ci-passed` is
   required in the branch ruleset, so skipped jobs never block a merge.
8. **Nightly full run.** A scheduled run on `main` runs every task without
   `--affected`, so anything the affected logic misses is caught within a
   day.
9. **Guard the skip logic.** A tiny job asserts that a change under
   `apps/api/src` makes `turbo run test --affected --dry=json` include
   `@alphaci/api#test`. If the affected detection silently skips work, the
   run fails instead of going green. (The article hid a change from Nx on
   purpose and six shards reported green.)
10. **Pre-push hook** with [lefthook](https://github.com/evilmartians/lefthook):
    `turbo run lint typecheck --affected` on the pushed range. Agents and
    people see type errors in seconds instead of after a CI round trip.
    `lefthook install` runs from the root `prepare` script.
11. **Branch ruleset on `main`:** require a PR, require `ci-passed`, block
    force pushes.

**What does not change.** Runners, Node versions per app (until wave B), the
checks themselves.

**How.** Build `ci.yml` next to the old workflows, run both on the same PR,
compare verdicts and minutes, then delete the old ones in the same PR.

**Done when.** A web-only PR runs no API jobs; a docs-only PR runs almost
nothing; billed minutes per both-apps push drop by at least half; `ci-passed`
is the only required check.

**Owner action.** Optional: create a Vercel access token for Remote Cache
and add `TURBO_TOKEN` / `TURBO_TEAM` secrets. Required: approve the ruleset.

---

## 3. Shared API contracts package

**Why.** The web app retypes backend types by hand
(`apps/web/src/shared/api/contracts.ts`, plus comments such as "Types mirror
the backend's `BrowserTestsService`"). They drift silently.

**What changes.**
- New `packages/api-contracts` (`@alphaci/api-contracts`).
- The API already depends on `@nestjs/swagger`. A script builds the Nest app
  without listening and writes `packages/api-contracts/openapi.json`.
- [`openapi-typescript`](https://openapi-ts.dev) turns it into
  `packages/api-contracts/src/schema.d.ts`; the package exports named types
  (`components["schemas"]["…"]`) and, optionally, a typed fetch client
  (`openapi-fetch`).
- Turbo: `@alphaci/api-contracts#build` depends on the API's `openapi` task;
  `@alphaci/web#typecheck` depends on `^build`, so a backend change that
  breaks the web app fails the same PR.
- A `check:contracts` task fails CI if the committed `openapi.json` is stale.
- Web types move over one feature at a time; hand-written duplicates are
  deleted as each feature migrates (no compatibility shims).

**Prerequisite.** OpenAPI is only as good as the decorators. Controllers
without `@ApiResponse`/DTO classes produce `unknown`. The first PR adds the
generator and migrates the endpoints that already have DTOs; the coverage
gap is listed in the PR.

**Done when.** `contracts.ts` re-exports generated types for every endpoint
that has DTOs, and the remaining hand-written types are listed with owners.

---

## 4. Dependency upgrades and toolchain alignment

See [Dependency upgrade plan](#dependency-upgrade-plan) below. Step 4 of the
original list ("line up tool versions, then share configs") is waves B and
E plus the shared config package at the end.

**Status (2026-11-02): done.** Waves A–E, js-yaml 5, the shared config
package and Node 26 have landed; the status of each is under its heading.

---

## 5. Release workflow for both images

**Why.** `deploy/selfhost/.env.example` expects
`ghcr.io/alpha-explora/alphaci-be` and `alphaci-fe` pinned by digest, but
nothing publishes them.

**What changes.**
- New `.github/workflows/release.yml`, triggered by tags `v*` (and manual
  dispatch for a dry run that builds without pushing).
- Builds both images from the root (`apps/api/Dockerfile`,
  `apps/web/Dockerfile` with the self-hosted build args), pushes them to GHCR
  with tags `<version>` and `sha-<commit>`, and attaches provenance and SBOM
  (`docker/build-push-action` with `provenance: true`, `sbom: true`).
- The release notes list both digests and a ready-to-paste block for
  `alphaci.env`: `ALPHACI_API_IMAGE=…@sha256:…`, `ALPHACI_WEB_IMAGE=…`.
- `TEMPLATE_CLONE_TOKEN` comes from a repo secret, used only in the API
  builder stage, as today.
- Permissions: `packages: write` only on the publish job.

**Owner action.** Add the `TEMPLATE_CLONE_TOKEN` secret (fine-grained,
contents:read on `alphaci-workflow`; the repo is public, so this can be
skipped). Pushing the first `v*` tag is a manual decision.

---

## 6. Move `deploy/selfhost` to the root

**Why.** The appliance runs both images; it does not belong to the API.

**What changes.**
- `apps/api/deploy/selfhost` → `deploy/selfhost` (history kept with
  `git mv`).
- The API image still needs `deploy/selfhost/postgres-init`: the API
  Dockerfile copies it from the root path, or the init SQL moves into
  `apps/api/supabase/` where the migration runner already looks. Pick the
  one with fewer path changes after reading `migrate-selfhost.ts`.
- `.dockerignore`, `.gitignore`, CODEOWNERS, `alphaci-ctl` doc paths,
  `docs/runbooks/runbook-selfhost-install.md`, the workspace `AGENTS.md`.

**Done when.** `alphaci-ctl init`/`doctor` and `docker compose config` work
from the new path, and the API image still runs migrations.

---

## 7. Web end-to-end against the real API

**Why.** Each app tests against fixtures of the other. A change that spans
both is only tested together in production.

**What changes.**
- A CI job (part of `ci.yml`, affected by either app) starts Postgres, runs
  migrations, starts the API with a test configuration, builds and starts
  the web app, and runs the web Playwright journeys against it.
- External calls (GitHub, Vercel, Render) stay stubbed on the API side, the
  same way the API end-to-end suite stubs them today.
- Runs on PRs that touch both apps or `packages/*`, and nightly.

**How.** Start from the API end-to-end fixture (it already starts Postgres
with Docker Compose) and the web `tests/e2e/playwright-e2e.ts` journeys.
First PR: one journey (sign-in with the dev quick-login, open the project
list). Then grow.

**Cost.** The slowest job; it runs only when both sides could be affected, so
it does not hold up single-app PRs.

---

## 8. Automated dependency updates

**What changes.** `.github/dependabot.yml` (built into GitHub, no app to
install):
- `npm` at `/`, weekly, grouped: `api-runtime`, `web-runtime`,
  `dev-tooling` (types, lint, test), and one group per framework family
  (`@nestjs/*`, `next`+`react*`, `typescript`+`typescript-eslint`).
- Minor and patch updates grouped into one PR per group; majors one PR each.
- `github-actions` ecosystem, monthly.
- `docker` ecosystem for both Dockerfiles (base image digests), monthly.

Renovate does monorepo grouping better, but needs the Renovate app installed
on the org. Dependabot first; switch only if the PR noise is a problem.

**Starts after** wave A, so the first batch of PRs is small.

**Status (2026-11-02): done in #8**, with majors and Node base-image majors
held back (#14) while the waves were done by hand. The Node 26 PR lifted both
holds; grouping and the 3-day cooldown stay.

---

## CI speed: what to take from the article

The article went from 40 minutes to 2. We start at about 4–6 minutes, so the
wins are smaller, but agents push often, so every minute of waiting compounds.

| Idea | Take it? | Where |
|------|----------|-------|
| Faster runners | **No, for now** (decision). | — |
| Oxlint instead of ESLint | **Yes, mostly.** Lint is our second-slowest step (59 s API, 36 s web). Oxlint's type-aware mode is stable (tsgolint), but it needs TypeScript 7 and does not cover every rule we use (`react-hooks/set-state-in-effect` from the React Compiler plugin, `eslint-config-next` rules, prettier). Run Oxlint for everything it covers and keep a slim ESLint pass only for the rest. | Wave E |
| Faster typechecker | **Yes, for checking only.** TypeScript 7 (`tsgo`) for `typecheck`. ts-jest, typescript-eslint and Nest's emit still need the TypeScript 6 API. | Wave E |
| Shard tests onto bigger machines | **Shard, no bigger machines.** `jest --shard=i/n` across 2–3 jobs on standard runners, only if the API suite still dominates after the transform change below. Shards are free on a public repo; each still pays its own setup time. | Step 2 follow-up |
| Stop reloading the app per test file | **Yes, differently.** The cheap win is the transform: `ts-jest` type-checks every file; `@swc/jest` only strips types (decorator metadata supported). Typecheck already runs as its own task. Vitest with `isolate: false` (Nest 12's default runner) is a bigger migration for 4,800 tests; revisit after measuring. | Wave B |
| Fix setup (cache `node_modules`, seed caches from `main`, blobless clone, match parallelism to cores) | **Yes, all of it.** `npm ci` is 26–85 s of every job; public-repo runners have 4 vCPUs, so match `--maxWorkers` to that. | Step 2 |
| Run everything in parallel | **Yes, with care.** The web job runs 15 steps in series. Split lint / typecheck / test / build, but share one cached install. | Step 2 |
| Only run what a PR touches, full run nightly, test the skip logic | **Yes.** `turbo --affected`, nightly schedule, skip-logic guard job. | Step 2 |
| Pre-push hook | **Yes.** lefthook: `turbo run typecheck --affected`, plus Oxlint and ESLint on the pushed files (wave E). | Step 2, wave E |
| Spend $4,300/month | **No.** Public repo, standard runners, no bill. | — |

---

## Dependency upgrade plan

Snapshot from `npm outdated` on 2026-11-01. "Wanted" is the newest version
the current range allows; "latest" may be a new major.

### Wave A: refresh within current ranges (low risk)

**Status (2026-11-02): done in #7.**

One PR. `npm update` for both apps. Lockfile only; `package.json` ranges do
not change.

| Package | From → to | App |
|---------|-----------|-----|
| `@nestjs/common`, `core`, `platform-express`, `testing` | 11.1.17 → 11.2.8 | api |
| `@nestjs/config` | 4.0.3 → 4.0.4 | api |
| `@nestjs/throttler` | 6.5.0 → 6.7.1 | api |
| `@nestjs/cli` / `schematics` | 11.0.17 / 11.0.10 → 11.0.24 / 11.1.0 | api |
| `@supabase/supabase-js` | 2.100.1 → 2.118.0 | api |
| `class-validator` | 0.14.1 → 0.14.4 | api |
| `helmet` | 8.1.0 → 8.3.0 | api |
| `pg` / `@types/pg` | 8.20.0 → 8.23.1 | api |
| `prettier` | 3.8.1 → 3.9.10 | api |
| `eslint` | 10.1.0 → 10.14.0 | api |
| `typescript-eslint` | 8.56.1 / 8.59.1 → 8.72.1 | both |
| `dependency-cruiser` | 18.2.0 → 18.7.0 | both |
| `supertest`, `ts-jest`, `ts-loader`, `eslint-plugin-prettier`, `@eslint/*` | patch/minor | api |
| `next`, `eslint-config-next` | 16.3.5 → 16.4.3 | web |
| `react`, `react-dom` | 19.2.5 → 19.3.1 | web |
| `@types/react`, `@types/react-dom` | → 19.3.0 | web |
| `tailwindcss`, `@tailwindcss/postcss` | 4.2.4 → 4.3.3 | web |
| `framer-motion` | 12.38.0 → 12.43.0 | web |
| `driver.js` | 1.4.0 → 1.10.2 | web |
| `jest`, `jest-environment-jsdom` | 30.3.0 → 30.5.2 | web |
| `playwright` | 1.59.1 → 1.64.1 | web |
| `stylelint` | 17.14.1 → 17.16.0 | web |
| `tsx` | 4.21.0 → 4.23.15 | web |

**Expected fallout.** This is the same set the first monorepo install
pulled in by accident, and it broke API lint: prettier 3.9 reformats some
union types and typescript-eslint 8.72 flags new unnecessary type
assertions. The PR includes `eslint --fix` output as a separate commit so
the review shows formatting apart from real changes. `next` 16.4 may change
generated `next-env.d.ts`; React 19.3 may surface new hook lint warnings.
The `stylelint` warning ceiling (`--max-warnings=715`) is re-measured.

**Verify.** Full gates for both apps (every CI step), both Docker images
build, the web image serves `/healthz`, the API image boots to the
`SESSION_SECRET` check.

### Wave B: align the toolchain across apps (dev dependencies only)

Goal: one version of each tool in the workspace, so configs can be shared
and the root `node_modules` holds a single copy.

| Change | Why / what breaks | How |
|--------|-------------------|-----|
| **Node 24 for both apps** (API image `node:22-alpine` → `node:24-alpine`, CI, `engines`) | API is the only Node 22 user. Node 24 is the active LTS. | Change the Dockerfile, CI, `.nvmrc`; run the API suite and e2e; boot the image. |
| **`@types/node` ^24** for both | Types should match the runtime: the API is on 22 types, the web app on 25. Do not jump to 26 (no Node 26 runtime). | Fix any type errors from removed or changed Node APIs. |
| **API TypeScript 5.9 → 6.0** | Web is already on 6.0. 6.0 deprecates options that 7 removes (`baseUrl` without `paths`, `moduleResolution: node10`, `target: es5`). | Fix new errors; keep `emitDecoratorMetadata`/`experimentalDecorators` (Nest needs them). |
| **API Jest 29 → 30** (+ `ts-jest` 29.4.x supports Jest 30; `@types/jest` 30; `jest-junit` 16 → 17) | Web is on 30. Jest 30 drops Node < 18, removes some deprecated matchers (`toBeCalled` → `toHaveBeenCalled`, etc.) and changes snapshot header text. | Run the suite; codemod renamed matchers; regenerate snapshots only where the header changed (review the diff). |
| **API test transform `ts-jest` → `@swc/jest`** | Biggest single test-speed win; ts-jest type-checks each file, typecheck is already its own task. SWC supports `legacyDecorator` + `decoratorMetadata`. | Add `.swcrc` with decorators on; keep `moduleNameMapper`; compare test count and time before/after. Keep ts-jest if any suite relies on type-level behaviour. |
| **Web ESLint 9 → 10** | API is on 10. Needs `eslint-config-next` with ESLint 10 support (check its peer range first; if not ready, wait). | Flat config already; fix new defaults. |
| **`globals` 16 → 17**, **`js-yaml` 4 → 5** (27 files), **`@testing-library/jest-dom` 6 → 7**, **`@types/supertest` 6 → 7** | Majors in tools/test libs. js-yaml 5 is the only one with runtime use (API parses workflow YAML). | One commit per package; read each changelog; for js-yaml, run the catalog/workflow-generation tests and the golden snapshots. |

**Status of the table (2026-11-02): done.** Node 24 for the API in #4.
TypeScript 6, ESLint 10, `@types/node` ^24, `globals` 17,
`@testing-library/jest-dom` 7 and `@types/supertest` 7 in #9. ts-jest stays
(transpile-only) instead of `@swc/jest`: the golden workflow snapshots embed
function source text, and SWC formats it differently from the `tsc` build that
ships. js-yaml 5 in its own PR, #19.

**Then:** `packages/config` with `tsconfig.base.json`, a shared ESLint/Oxlint
config and the prettier config. Both apps extend it. Add `syncpack` (or
npm `overrides`) with a `check:versions` task so the versions stay aligned.

**Status (2026-11-02): done in #24, smaller than planned.** `packages/config`
(`@alphaci/config`, a devDependency of both apps, no build step) holds only
what both apps already set identically:

- `tsconfig.base.json`: `strict`, `skipLibCheck`, `isolatedModules`,
  `esModuleInterop`, `allowJs: false`, `incremental`. Both app
  `tsconfig.json` files extend it. `tsc --showConfig` (TypeScript 6 and 7) is
  identical before and after for all five projects; no option was unified.
  `forceConsistentCasingInFileNames` stays in the API only (the web app
  relies on the default). `packages/api-contracts` does not extend it: it
  sets neither `esModuleInterop` nor `incremental`.
- `oxlint.base.json`: the 22 rules both `.oxlintrc.json` files enforced with
  the same settings. Both extend it. Categories stay in each app because
  `eslint-plugin-oxlint` reads them only from the file it is given; it does
  follow `extends` for rules, so ESLint still turns the shared ones off.
- No shared ESLint config: after wave E the two `eslint.config.mjs` files
  share no rules (the API keeps prettier, `consistent-type-imports` and
  `no-octal`; the web app keeps Next's leftovers).
- No shared Prettier config: only the API uses Prettier.

`check:versions` is `scripts/check-versions.mjs`, a dependency-free script
(no syncpack): it fails when a dependency listed by more than one
`package.json` has different ranges, with an allowlist for intentional
differences. CI runs it in the `plan` job. It found three mismatches, aligned
to the version already installed: `eslint` (API `^10.1.0` → `^10.14.0`),
`jest` (web `^30.3.0` → `^30.5.2`), `typescript-eslint` (API `^8.20.0`, web
`^8.59.1` → `^8.72.1`).

### Wave C: API runtime majors

One PR per row.

**Status (2026-11-02): done, except `google-auth-library`.** NestJS 12 in
#16. `class-validator` 0.15 and `express` 5.3 came in a grouped Dependabot
PR (#12). `google-auth-library` stays on 10: there is still no GCP sandbox to
verify 11 against.

| Change | What changes for us | How |
|--------|---------------------|-----|
| **NestJS 11 → 12** (`@nestjs/common`, `core`, `platform-express`, `testing`, `cli`, `schematics`, `swagger` 12, `config` 12) | Core ships as ESM but CommonJS apps keep working through `require(esm)` (Node ≥ 22.12; we are on 24 after wave B). `@nestjs/config` moves validation to Standard Schema; **we use no Joi `validationSchema`**, so no change. `ConsoleLogger` treats objects after the message as structured params; we found no `logger.x(msg, {…})` calls, but log-shape tests are checked. Route-conflict options are opt-in. | `npx @nestjs/cli upgrade --dry-run`, then apply; full suite, boot smoke, e2e, Docker image boot. Do not switch to ESM or Vitest in this PR. |
| **`class-validator` 0.14 → 0.15** (83 files) | Validation behaviour of a widely used library; check changelog for decorator/option changes. | Upgrade after Nest 12 (its `ValidationPipe` peer range); run DTO and controller specs. |
| **`google-auth-library` 10 → 11** (1 file: GCP runtime adapter) | Auth client API changes. | Adapter tests; manual check against a GCP sandbox if one exists, otherwise keep on 10 until there is a way to verify. |
| **`express` 5.2 → 5.3** | Minor. | Ride along with Nest 12. |

### Wave D: web runtime majors

**Status (2026-11-02): done in #21.** No code changes were needed.

| Change | What changes for us | How |
|--------|---------------------|-----|
| **`framer-motion` 12 → 14** (59 files) | Two majors. Read both changelogs; the library has been moving to the `motion` package name. | Codemod imports if renamed; visual check of animated views (project page tabs, studio panels) with the dev server and screenshots before/after. |

Next, React and Tailwind are already handled in wave A (minors).

### Wave E: TypeScript 7 and Oxlint

Last, because the TypeScript 7 ecosystem is still settling: TypeScript 7.0
(July 2026) ships the Go compiler without a stable programmatic API (planned
for 7.1). ts-jest, typescript-eslint and other API users keep needing
TypeScript 6.

| Change | How |
|--------|-----|
| Keep TypeScript 6 for API users | `"typescript": "npm:@typescript/typescript6@^6"` alias, so ts-jest, typescript-eslint, Nest's `tsc` emit and `next build`'s type step resolve 6.x. |
| TypeScript 7 for `typecheck` | Add TypeScript 7 under an alias (for example `"typescript-7": "npm:typescript@^7"`) so it does not shadow the 6.x `typescript` package, and call its compiler by path from the `typecheck` scripts. Nest still emits with 6, so `emitDecoratorMetadata` output does not change; 7 only checks. |
| Oxlint | `oxlint` + `oxlint-tsgolint` for type-aware rules. Map current rules; run both linters in parallel for one PR and compare findings; then keep ESLint only for rules Oxlint lacks, using `eslint-plugin-oxlint` to turn off the overlap. Prettier stays as the formatter (or Oxc's formatter later, separately). |

**Done when.** `lint` and `typecheck` each take a few seconds per app in CI,
and no rule we enforce today was dropped without a written decision.

**Status (2026-11-02): done in #22, with two deviations.**

- `typescript` stays the real `typescript@^6.0.3` instead of the
  `@typescript/typescript6` alias: that package is a shim (`main` and
  `lib/tsc.js` only), so tools and editors that read `typescript/lib/*`
  would break. TypeScript 7 is `"typescript-7": "npm:typescript@^7.0.2"` at
  the root. Both ship a `tsc` binary and only one can own
  `node_modules/.bin/tsc` (here it was 7), so scripts call each compiler by
  path: `typecheck` uses `typescript-7/bin/tsc`, and the API `build` (Nest's emit) uses
  `typescript/bin/tsc`. TypeScript 7 accepts the API's
  `experimentalDecorators`/`emitDecoratorMetadata` for checking and checks
  the same files (2,361 API, 1,607 web) with zero errors.
- Lint is not "a few seconds" for the API yet: Oxlint runs every rule it has
  in 2–5 s, but the ESLint pass keeps `prettier/prettier`, and Prettier itself
  takes ~20 s for 1,075 files (its CLI is no faster). Moving formatting to
  Oxc's formatter is the next step, separately.

Rules: the API keeps 3 of 93 rules in ESLint (`prettier/prettier`; `no-octal`,
which Oxlint lacks; `@typescript-eslint/consistent-type-imports`, because
Oxlint's version ignores decorator metadata and would demand `import type`
for Nest constructor injection). The web app keeps 4 of 87
(`react/no-deprecated`, `@next/next/no-location-assign-relative-destination`
and the no-op `react/jsx-uses-*` helpers). Oxlint covers the React Compiler
rules: on three historical snapshots with every `eslint-disable` stripped it
reported the same `set-state-in-effect` (25/25, 18/18, 2/2), `refs`,
`use-memo`, `exhaustive-deps` and `complexity` (46/46) findings as ESLint.
Two rules were dropped on purpose: `react-hooks/config` and
`react-hooks/gating` only validate React Compiler plugin options, which we do
not set, yet they compiled every file (32 s of the web lint). The web lint
stays non-type-aware, as it was.

Measured locally on the same machine (CI runners have been about 1.5–2×
faster): typecheck API 21 s → 2.5 s, web 30.5 s → 2 s; lint API 143 s →
22 s, web 115 s → 12.5 s. The pre-push hook now lints the pushed files of each
app (Oxlint, then ESLint), in about ten seconds with the typecheck.

### Node 26

Node 26 became the active LTS in October 2026 (Dependabot proposed the base
images in #10, closed). Move in one PR: both Dockerfiles, `NODE_VERSION` in
`ci.yml`, `.nvmrc`, root `engines`, `@types/node` ^26, then the full gates and
an image boot. Dependabot skips Node majors for base images until then.

**Status (2026-11-02): done in #26.** Both Dockerfiles (`node:26-alpine`),
`NODE_VERSION` in `ci.yml`, `node-version` in `onprem-agent-release.yml`,
`.nvmrc`, root `engines` (`>=26`), `@types/node` ^26 in both apps, and the
docs that named Node 24. The Node versions offered to customers' projects
(catalog, scaffold, wizard) are unchanged. The same PR removed Dependabot's
npm `semver-major` ignore and its `node` base-image major ignore.

### Rollback

Every wave is its own PR on top of a green `main`, and the lockfile is the
only shared file. Reverting a wave is `git revert <merge commit>` followed by
`npm install` from the reverted lockfile.
