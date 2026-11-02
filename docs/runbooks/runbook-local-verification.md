---
type: "Playbook"
title: "Local verification"
description: "Reproducible local checks for both apps, the capability catalog, migration planning, and the documentation bundle."
tags: [runbook, verification, development]
status: stable
sources:
  - id: root-scripts
    resource: "package.json"
    title: "Repository verification scripts"
  - id: api-scripts
    resource: "apps/api/package.json"
    title: "API verification scripts"
  - id: web-scripts
    resource: "apps/web/package.json"
    title: "Web verification scripts"
  - id: ci-workflow
    resource: ".github/workflows/ci.yml"
    title: "Continuous integration workflow"
---
# Local verification

Use this sequence before merging a change that affects source, schemas, providers, events, styles, capability surfaces, or documentation.

## Preconditions

- Use Node.js 26 (the root `.nvmrc`), as configured by CI.
- Install the exact lockfile from the repository root with `npm ci`.
- Provide API environment values from `apps/api/.env.example` when a boot or integration check needs them.
- Provide `NEXT_PUBLIC_API_BASE_URL` when a running web app or authenticated check needs the API. `NEXT_PUBLIC_API_URL` remains a legacy alias.
- Do not store provider tokens in the browser or in web environment files.
- Do not run database mutation commands against a shared environment without an approved target and rollback plan.

Commands below run from the app folder named in each section. From the repository root, `npm run <script> -w @alphaci/api` or `-w @alphaci/web` runs the same script.

## Fast documentation loop

```bash
# apps/api
npm run generate:architecture-maps
npm run check:capabilities
npm run check:composition-source
npm run check:capability-ledger
npm run check:documentation

# apps/web
npm run generate:architecture-maps
npm run check:capabilities
npm run check:documentation

# repository root
npm run check:documentation
npm run test:documentation
git diff --check
```

Each app's `generate:architecture-maps` writes its `*.generated.md` maps into `docs/`; the web one also writes the three `pack.md` profiles. The root `check:documentation` validates the bundle (OKF v0.2 format, links, naming, current-state wording, npm scripts named in docs, and that no app keeps its own `docs/` folder), runs both generators with `--check` to catch drift, then runs both apps' own checks through Turbo.

The web profile and documentation checks consume the `@alphaci/capability-catalog` workspace package (`packages/capability-catalog`). After a catalog change, run `npm run package:capability-catalog` in `apps/api`, then in `apps/web` run `npm run generate:architecture-maps`. `npm run capability:new` in `apps/api` runs that chain for a new capability.

## Full API loop

```bash
npm run typecheck
npm run lint
npm test -- --ci --runInBand
npm run build
npm run boundaries
npm run check:application-boundaries
npm run check:provider-encapsulation
npm run check:schema-ownership
npm run check:capabilities
npm run db:apply:all -- --dry-run
npm run check:documentation
git diff --check
```

`npm run db:migrate:selfhost -- --dry-run` lists the same tree in the self-hosted runner's order, with each file's transaction mode and checksum.

### Focused API checks

```bash
npm test -- --ci --runInBand tests/architecture/http-boot.spec.ts
npm test -- --ci --runInBand tests/architecture/outbox-scheduler.spec.ts
npm test -- --ci --runInBand tests/architecture/provider-plugin.acceptance.spec.ts
```

### API end-to-end suite

`npm run test:e2e` needs Docker. It starts the disposable loopback PostgreSQL fixture in `apps/api/tests/integration/database/compose.yaml`, creates a fresh database, applies every migration, and boots the real application and HTTP middleware against it. Scenarios sign in through loopback quick login and call the API. GitHub, CI token, and deployment provisioning ports are recording fakes, so no provider is contacted. The suite ignores `.env` files and removes provider credentials from its environment. It refuses a non-loopback database.

To reuse a running loopback PostgreSQL, set `E2E_DATABASE_URL` to its admin connection; the suite then leaves the container running.

Scenarios that create projects read the central workflow templates from `TEMPLATE_REPO_PATH` (default `../../../alphaci-workflow` from `apps/api`, a checkout next to the monorepo of `Alpha-Explora/alphaci-workflow`).

Each run writes `artifacts/e2e/<commit>/report.json` with the commit, a dirty flag, the command, the database image, and each scenario's result. CI runs the same command in the `End-to-end suite (Postgres fixture)` job, against a pinned `alphaci-workflow` commit, and uploads the report as `e2e-report` when the job fails.

## Full web loop

```bash
npm run typecheck
npm run lint
npm run lint:css
npm run boundaries
npm run arch:check
npm run complexity
npm test
npm run build
npm run check:documentation
```

CI (the `Web …` jobs of `.github/workflows/ci.yml`) also runs `npm run check:profiles` and builds both profiles with `node scripts/build-profile.cjs --profile hosted` and `--profile enterprise`. Each profile build runs the exclusion check on its output.

There is no accepted web test failure baseline. `npm test` runs the whole suite with coverage and fails below the coverage floor in `apps/web/jest.config.js`. Compare a failing run with the same command on `main` before attributing a failure to a change.

## Evidence

Record the commands run, pass/fail result, intentionally skipped integration or authenticated checks, and any external environment required. A static pass does not prove live PostgreSQL, a live session cookie, CORS, provider APIs, deployed scheduling, or rollback behavior.
