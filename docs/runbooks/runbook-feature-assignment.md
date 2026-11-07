---
type: "Runbook"
title: "Assign a feature to editions and personas"
description: "Add or change capability membership, user action permissions, and their generated documentation."
tags: [capabilities, packs, personas, development]
status: stable
sources:
  - id: catalog-source
    resource: "apps/api/src/kernel/composition/catalog.source.json"
    title: "Capability authoring source"
  - id: scaffolder
    resource: "apps/api/scripts/new-capability.cjs"
    title: "New capability command"
  - id: source-validator
    resource: "apps/api/scripts/lib/composition-source.cjs"
    title: "Source validation and generation"
  - id: persona-rules
    resource: "apps/api/src/kernel/rules/persona-access.rules.ts"
    title: "Shared persona action rules"
  - id: qa-rules
    resource: "apps/api/src/modules/projects/domain/qa-run-access.rules.ts"
    title: "Project QA action rules"
---

# Assign a feature to editions and personas

Use this procedure for a new capability or a change to an existing capability's edition membership. Run commands from the repository root after installing the repository's locked workspace dependencies. The [capability contract](../capabilities/capability-contract.md) defines the model; the [persona workflow](../design/persona-workflow.md) defines current delivery responsibilities.

## Choose the boundary

1. Identify the user outcome and owning API context.
2. Trace the existing capability, routes, workers, machine callbacks, and UI that provide related behavior.
3. Decide whether the feature belongs inside that capability or needs an independent entitlement. A new action or screen alone does not require a new key.
4. Select applicable editions from `saas`, `edu`, and `enterprise`.
5. Define the permitted persona actions and resource scope separately. `member`, `qa`, `lead`, and `admin` are user roles, not editions.
6. Record deployment and provider prerequisites. Internal organization membership does not create an edition, grant admin, or bypass capability enforcement.

For an existing broad capability, removing an edition also removes its other composed behavior. For example, removing shared provisioning to restrict host enrollment would affect ordinary hosting as well. Review that boundary before changing membership.

## Add a new capability

The following command declares an illustrative feature. Choose a real unused key and description before running it:

```powershell
npm run capability:new -w @alphaci/api -- --key projects.release-approval --description "Controlled production approval." --editions enterprise --summary "Declare the production approval capability."
```

The command defaults to `not-implemented`. It writes metadata, generates registry and manifests, packages the shared catalog, appends the ledger, and regenerates API maps through the ledger command and web maps directly. It does not implement business behavior, configuration, endpoints, UI, persistence, or permissions.

For behavior that exists, pass the actual values for these options:

| Option | Record or code decision |
|---|---|
| `--context` | Owning bounded context; otherwise derived from the key prefix |
| `--maturity` | `stable`, `limited`, or `not-implemented`, supported by implementation evidence |
| `--configuration` | Human-readable enablement explanation |
| `--flags` | Comma-separated boolean AppConfig paths for the base capability |
| `--requires` | Comma-separated required capability keys |
| `--api-field`, `--view-flag` | Existing compatibility response and UI flag names, when exposed |
| `--domains`, `--routes`, `--barrels` | Actual web domains, routes, and public feature barrels |
| `--artifact-symbols` | Unique real implementation exports checked for profile exclusion |
| `--reference` | Change record explaining the decision; defaults to `CHANGELOG.md` |

A `not-implemented` record must not claim implemented configuration flags or an API compatibility field. Add those when the behavior exists.

Preview the same command with `--dry-run` first. It validates the complete proposed source and prints the record without writing files or running generators. Unknown, duplicate, or empty edition selections fail before writes; the source validator also rejects empty memberships. A valid list is stored in canonical edition order. An unsupported value such as `internal` does not create a pack. If a follow-up generator fails during a real write, the source may already have been written; inspect the diff and complete or revert the partial metadata change before continuing.

## Record a built feature inside a capability

Add a descriptive entry to the top-level `features` array in `catalog.source.json`. Use a unique identifier, a title, the availability source, repository-file references for implementation, authorization and evidence, and prerequisites. Capability references inherit current membership and maturity. Use the separate deployment or web-build availability forms for those contracts; do not infer an API capability grant from a deployed appliance or a marketing page.

Do not copy `editions` or role allow-lists into a feature entry. Reference the actual action-rule files instead. Optional historical origin records a repository and full commit SHA; verify that the commit supports the claimed origin. Regenerate with `npm run generate:architecture-maps -w @alphaci/api`, package the source to refresh its provenance digest, and run the source and documentation checks. Adding only descriptive details does not change the runtime composition hash or require a capability lifecycle ledger entry.

## Change an existing assignment

1. Edit the record's `editions` in `apps/api/src/kernel/composition/catalog.source.json`. Preserve the order `saas`, `edu`, `enterprise` and include at least one applicable edition.
2. Check that every required capability belongs to each selected edition.
3. Update maturity, configuration, description, or UI metadata when the behavior also changes.
4. Generate composition and package artifacts:

```powershell
npm run generate:composition -w @alphaci/api
npm run package:capability-catalog -w @alphaci/api
```

5. Record the membership decision. Replace the example key, summary, and reference with the actual change:

```powershell
npm run ledger:record -w @alphaci/api -- --change membership-changed --keys projects.example --summary "Explain why the edition membership changed." --reference CHANGELOG.md
npm run generate:architecture-maps -w @alphaci/web
```

The ledger command also refreshes API maps. If maturity changes, record the corresponding `maturity-changed` event. Wording-only changes do not require a lifecycle entry. Do not hand-edit the generated registry, manifests, catalog package, matrices, ledger document, or pack profiles.

## Enforce behavior and persona actions

1. Implement the feature in its owning API context and add any named flag to AppConfig with a real configuration source.
2. Protect product HTTP handlers with `@RequiresCapability(...)` and `CapabilityGuard`. Preserve authentication before composition and subscription enforcement afterward where applicable.
3. Apply the action and resource policy in the owning service or domain rules. Use the shared persona rules when multiple contexts own the same rule. A catalog record has no `allowedRoles` field.
4. Inspect non-HTTP paths separately. A machine token, background worker, alternate endpoint, or stored result must not provide an unintended way around the new boundary.
5. Return permitted actions to the UI where a permission response exists. Hide unavailable controls and keep backend authorization authoritative.
6. Add the actual UI routes and barrels to the source record. If provider behavior is optional, report provider readiness separately from base capability membership.

## Verify the assignment

Cover included and excluded editions, allowed and denied personas, resource membership, disabled flags, dependency removal, and relevant provider behavior. Test the actual action, not only the catalog record. For an exclusion change, inspect the profile build artifact as well as its metadata.

Run the composition and documentation checks:

```powershell
npm run check:composition-source -w @alphaci/api
npm run check:capability-package -w @alphaci/api
npm run check:capabilities -w @alphaci/api
npm run check:capability-ledger -w @alphaci/api
npm run check:composition-profiles -w @alphaci/api
npm run check:capabilities -w @alphaci/web
npm run check:profiles -w @alphaci/web
npm run check:documentation
```

Run the affected behavior tests and required profile builds. HTTP route coverage requires either effective capability metadata and its guard, or an explicit documented exception in the route-coverage architecture test. UI visibility alone is not enforcement.

Update the affected current-state concept and `docs/log.md` when a contract changes. Add one root changelog line for a user-visible change. Pack prose belongs in the web generator's `PACKS` table; regenerate its profiles instead of editing them.

## Diagnose a deployment

1. Run `./alphaci-ctl composition` in the appliance directory. For a compiled API artifact, run `node dist/cli/alphaci-ctl.js composition` with its normal environment and secret-file paths. The command validates actual local configuration and emits JSON; it contacts neither the database nor providers.
2. Find the key in `decisions`. `build-profile` and `edition` identify the artifact and preset; `client-policy` identifies a deny-only removal; `not-implemented` identifies a placeholder. `configuration` lists disabled boolean paths. `dependency` lists required keys absent from the final set.
3. If composition allows the key, inspect the returned API action permissions, persona/resource rules, subscription, workflow preconditions and provider diagnostics separately. The command's `notEvaluated` list explicitly marks these limits. A composition allowance does not grant an actor permission.
4. For the new shared boundaries, `RELEASE_GOVERNANCE_ENABLED=false` rejects PO acceptance, iteration start and governed merge actions; `MANAGED_HOST_DELIVERY_ENABLED=false` rejects managed-host requests. Both default on in SaaS, EDU and Enterprise. The required QA/provisioning capabilities still apply; host operation also needs `ONPREM_RELEASES_ENABLED=true` and its signing/provider configuration.
5. Restart the API after configuration changes. Keep the web build's edition/profile aligned with that deployment. Confirm the API capability projection and actual denied/allowed action. Do not use this command to claim a tenant-specific assignment: the current source selects one composition for the deployment.

Before recovering a feature from an old repository, consult the [legacy reconciliation](../plans/golden-copy-persona-map/legacy-reconciliation.md). Reconcile UI, API, persistence, authorization and provider behavior before marking a historical journey integrated. Origin metadata never grants access.
