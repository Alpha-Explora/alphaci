# Remaining commercial composition proposals

Date: 2026-11-05. Status: future product decisions; local control separation is implemented. Baseline investigation: `214ef9ba`.

The [capability contract](../capabilities/capability-contract.md), [generated built inventory](../capabilities/feature-inventory.generated.md), and [assignment runbook](../runbooks/runbook-feature-assignment.md) describe the delivered behavior. Historical evidence is in the [investigation](golden-copy-persona-map/investigation.md) and [legacy reconciliation](golden-copy-persona-map/legacy-reconciliation.md). The [interactive map](golden-copy-persona-map/feature-map.html) separates current applicability from proposals.

## Decisions already applied

- Preserve existing SaaS and EDU access. `projects.release-governance` and `runtime.managed-host-delivery` are separate shared, default-on capabilities, with their existing QA/provisioning dependencies and mandatory safety rules.
- Keep one edition per deployment. Use matching API startup and web build presets; retain the subject-aware policy seam. No mixed-tenant entitlement store is needed for the chosen operating model.
- Keep historical origin descriptive. EDU prototype and branch-only journeys do not become available merely because their source exists elsewhere.
- Author metadata once. Validate new capabilities and descriptive feature references, generate the inventory and catalog projections, and diagnose local composition with `alphaci-ctl composition`.

## Proposed future assignments

The [full product feature map](golden-copy-persona-map/product-feature-map.md) and [interactive version](golden-copy-persona-map/product-feature-map.html) list feature contents and current pack membership before any commercial reassignment. They include every catalog record, shared application areas without independent pack keys, web/deployment exceptions, and reconciled historical journeys. Refresh both with `node docs/plans/golden-copy-persona-map/build-product-map.cjs`.

The [frontend/persona matrix](golden-copy-persona-map/frontend-persona-map.md) adds every current page and project tab, persona-specific visibility and actions, hidden or blocked controls, backend authorization differences, and implementation references. The interactive map provides both feature and frontend views with pack/persona filters.

These are recommendations, not current commercial restrictions. Do not remove an existing customer's access through metadata cleanup.

| Area | Recommendation | Required decision before implementation |
|---|---|---|
| Repository, CI, ordinary hosting, requirements, test cases and QA feedback | Shared SaaS, EDU and Enterprise foundation | Define any usage limits separately from feature identity. |
| Governed release approval and iteration controls | Enterprise; institutional EDU by agreement | Product packaging, existing-customer grants, migration/support path and denied-action UX. Current SaaS/EDU grants stay intact until separately authorized. |
| Managed hosts, enrollment and fleet delivery | Enterprise; institutional EDU add-on | Packaging, support responsibilities, existing assignments, upgrade behavior and workload lifecycle. Current grants stay intact. |
| Self-hosted appliance | Enterprise distribution; evaluate institutional EDU | Distribution/support obligation, upgrade policy and provider prerequisites. Self-hosted does not establish air-gap readiness. |
| Classes, rosters, assignments, grading and lab operation | EDU roadmap | Reconcile the legacy journey end to end before porting; define student/teacher permissions and production persistence. |
| Marketing and self-serve account/payment flows | SaaS | Landing UI already exists; checkout restoration and the unmerged auth branch are separate projects. |
| Internal operation | Explicit preset using a normal base edition | Define any audience-specific restriction separately from billing exceptions and user roles. |

## How other products handle this

The [first-party comparison](golden-copy-persona-map/industry-patterns.md) records sources and limits. GitLab separates offering, subscription and role/resource permissions; its licensed-feature checks are scoped to project, namespace or instance. Stripe Entitlements maps stable feature identities to products and a customer's active entitlements. OpenFeature standardizes flag evaluation and context; it does not define contractual access or AlphaCI action permissions.

Adopt the separation rather than a new external dependency. AlphaCI already has a validated source, composition ports, deny-only policy, guards and generated projections. Continue expanding the built-feature inventory as journeys are reconciled. Add a narrower capability only where an independently enforceable boundary exists. Keep provider readiness and action authorization separate from composition diagnostics.

## Conditions for mixed-edition hosting later

Only start this work if one hosted API must serve customers with different packages simultaneously. A correct implementation needs a subject-bound entitlement source; consistent capability advertisement and enforcement; tenant-bound cache keys; worker identity propagation; explicit internal/support impersonation rules; deny-by-default behavior for missing identity; and two-tenant isolation tests.

If billing synchronization is selected, persist a versioned local entitlement projection, handle events idempotently, reconcile missed events, and define stale-state behavior. Self-hosted requests must not depend on a live billing or flag service. No billing provider, tenant database schema, school-workflow port, commercial exclusion, deployment or publication is selected by this plan.
