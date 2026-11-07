# Internal client and capability options

Status: planned on 2026-11-07. Step 1 is in progress; steps 2 and 3 are not built. Delete this plan once step 3 lands and its lasting decisions are in ADR-0023, the capability contract and the changelog.

## Goal

Alpha Explora's own hosted deployment (API on Render, web app on Vercel) must be able to differ from Enterprise and St. Peter without a fork, a branch or a tag:

- remove a capability for internal only (exists: client policy, ADR-0009);
- change how an existing capability behaves for internal only (missing: this plan's capability options).

Every deployment runs the same code. A deployment that sets nothing keeps today's behavior.

## Decisions

- The internal client id is `alphaexplora-internal` (matches `CLIENT_ID_PATTERN`). It is declared in `apps/api/src/packs/enterprise/clients/index.ts` beside `st-peter`.
- Its policy disables nothing for now.
- Internal keeps sharing its database with the old Enterprise Render deployment for now.
- Release timing for Enterprise GCE (required reviewers or tag-triggered deploys) is deferred. Until then, a merge to `main` reaches Enterprise GCE within minutes; pause the deploy workflow around step 2 if needed.
- Onboarding further Render/Vercel clients and per-client branding are out of scope.

## Step 1: declare the internal client

- `apps/api/src/packs/enterprise/clients/index.ts`: the `alphaexplora-internal` policy.
- `apps/api/src/packs/enterprise/client-policy-pack.spec.ts`: resolution, isolation from `st-peter`, unknown-client message.
- `apps/api/scripts/run-edition.mjs`, `apps/api/package.json`: `enterprise-internal` mode and `start:enterprise-internal`.
- `apps/api/deploy/env/enterprise-internal.env`: non-secret preset.
- Rollout: `ALPHACI_CLIENT=alphaexplora-internal` on the Render web service and the outbox cron. Check `/api/v1/capabilities` shows the client on internal and nothing changes on Enterprise.

## Step 2: capability options (no behavior change)

An option changes how an available capability behaves. It is declared on the capability record, has a closed set of values and a default equal to current behavior, is set at the deployment-configuration layer (environment), never enables a capability, and is never selected by comparing a client id.

- `docs/architecture/decisions/adr-0023-capability-options.md` and its line in `decisions/index.md`.
- `apps/api/src/kernel/composition/catalog.source.json`: optional `options` on a record (`key`, `env`, `values`, `default`, `description`).
- `apps/api/scripts/lib/composition-source.cjs`, `scripts/generate-composition-source.mjs`: validate and render options; regenerate `capability-registry.ts` and `capability-record.types.ts`; `npm run package:capability-catalog` regenerates `packages/capability-catalog`.
- `apps/api/src/kernel/composition/capability-options.ts` (parse and validate at boot, unknown value stops the boot) and `capability-options.port.ts` (deployment-scoped token); wired through `composition-config.ts`, `composition.module.ts`, `index.ts`.
- `apps/api/src/kernel/config/app.config.types.ts`, `env.validation.ts`, `apps/api/.env.example`.
- `apps/api/src/modules/identity-access/capabilities/api/capabilities.controller.ts`: each feature block gains `options`.
- `apps/web/src/shared/api/contracts.ts`; `apps/web/src/features/capabilities/current/{data/capabilities-repository.ts, model/capability-flags.ts, view-models/use-capabilities-view-model.ts}`.
- `apps/api/scripts/check-capabilities.cjs`: one owner per option, unique env names, default within values, options only on implemented records.
- `apps/api/scripts/check-documentation.cjs`, `apps/web/scripts/check-documentation.cjs`: reject client-id comparisons as well as edition comparisons.
- `docs/capabilities/capability-contract.md`, generated maps, `docs/log.md`, `CHANGELOG.md`.
- Verification: with no option set, `/api/v1/capabilities` equals today's response plus empty `options`; full CI suite.

## Step 3: first option, test case authors

- `projects.qa-checklists` option `testCaseAuthors`, env `QA_TEST_CASE_AUTHORS`, values `qa-team` (default) and `qa-team-and-leads`.
- API: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts` (`canManageTestCases`, `canRecordTestCaseResults` take the option); callers in `application/qa-checklists/qa-test-cases.service.ts` and `application/qa-runs/qa-project-runs.service.ts` read it through the token.
- Web: `apps/web/src/features/checklists/model/test-case-rules.ts` fallback uses the option.
- Tests: default keeps leads at 403; `qa-team-and-leads` admits them; web rule agrees.
- Docs: ADR-0014 amendment, `docs/log.md`, `CHANGELOG.md`, and the line in `apps/api/deploy/env/enterprise-internal.env`.
- Rollout: `QA_TEST_CASE_AUTHORS=qa-team-and-leads` on the internal Render service only.

