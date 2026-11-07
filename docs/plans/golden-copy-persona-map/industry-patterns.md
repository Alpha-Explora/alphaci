# How other products separate tiers, permissions, and rollout

**Research checked:** 2026-11-05. This is a proposal input, not a description of AlphaCI's current implementation. Vendor docs change; recheck before adopting a concrete integration.

## Patterns from primary sources

| Example | Documented pattern | What AlphaCI can take from it |
| --- | --- | --- |
| GitLab | A buyer chooses an **offering** (GitLab.com SaaS, Self-Managed, or Dedicated) and a **subscription tier** separately. GitLab says a Self-Managed subscription applies to the whole instance; add-ons can layer on extra features, and availability can depend on both offering and tier. [GitLab plans](https://docs.gitlab.com/subscriptions/choosing_subscription/) | Model commercial package and deployment offering as separate dimensions. Avoid treating “enterprise deployment” as synonymous with “Enterprise tier.” Introduce add-ons only when there is a real separately sold capability. |
| GitLab | A member's **role** controls permissions; users can have different roles at group/project scope, with inheritance. The permissions reference annotates individual actions with tier/offering constraints, demonstrating that product access and user action authorization compose. [Roles and permissions](https://docs.gitlab.com/user/permissions/) | First check the organization's entitlement to a feature, then authorize the actor on the relevant resource/action. A tier assignment must never grant a user permission by itself. |
| Stripe Billing | Stripe models reusable features associated with products and reports changes to a customer's active entitlement summary. [Entitlements API guide](https://docs.stripe.com/billing/entitlements?dashboard-or-api=api) | If AlphaCI later needs billing-driven provisioning, map sellable products to stable capability keys and synchronize customer entitlements. Keep the mapping adapter outside the capability catalog so billing can change without rewriting feature identity. This does not imply adding Stripe now. |
| OpenFeature | The standard API evaluates flags to change control flow, supplies a default for error cases, and can return evaluation reason/variant metadata. Evaluation context carries targeting attributes (such as subject, app, or host) for flag rules. [Evaluation API](https://openfeature.dev/docs/reference/concepts/evaluation-api/), [evaluation context](https://openfeature.dev/specification/sections/evaluation-context/) | Use flags for controlled rollout, experiments, or operational kill switches. They are runtime decisions, distinct from an edition's contractual entitlement. The OpenFeature spec defines flag evaluation context; it does not define authorization. |

## Proposed AlphaCI model

Represent four independent questions, with explicit answers and owners:

1. **Offering/deployment:** hosted SaaS, customer-operated self-hosted, or internal deployment. This answers where/how the instance runs.
2. **Product package/entitlement:** SaaS, Education, or Enterprise. An internal preset selects a base edition and operating policies; it is not another product edition. Record historical origin separately as provenance; origin does not determine current entitlement.
3. **Actor authorization:** role plus resource scope and action (for example, member/QA/lead/admin on a project). This answers what this signed-in person may do. Preserve direct backend enforcement; UI visibility is a convenience, not enforcement.
4. **Rollout state:** flag by environment/cohort/subject, with owner, reason, and expiry/review date. This answers whether already-entitled behavior is currently being exposed or rolled out. Do not use a rollout flag as the durable package ledger or as an authorization check.

For a request, effective access should be explainable as: **capability implemented and enabled for deployment** AND **included in tenant entitlement** AND **rollout permits exposure (if applicable)** AND **actor is authorized for this resource/action**. If an axis does not apply, record that explicitly. Expose a diagnostic reason such as “not in package,” “deployment unsupported,” “rollout disabled,” or “role lacks action” so support can distinguish causes.

Keep provenance and present assignment as separate fields: `origin=enterprise` can coexist with `included_in=[saas, education, enterprise]`. For any reassignment, require an owner to record rationale, compatibility/operational costs, customer impact, and whether existing tenants retain access. Do not infer “Enterprise-only” from where a feature was first built.

## Improvement sequence

1. Maintain one stable capability key and add explicit metadata for provenance, maturity, package inclusion, deployment requirements, and accountable owner. Keep the existing catalog as the source of capability identity; generate the human-readable comparison from it.
2. Add a reviewable feature-change checklist/template: key and user outcome; code/API surfaces; dependencies; target packages and deployments; origin; auth requirements; migration/default behavior; tests; docs/matrix update; rollout/rollback plan. Unknown package IDs should fail validation rather than silently produce an empty matrix.
3. Generate both package comparison and “why available?” diagnostics from the same validated input. Avoid maintaining parallel manual matrices that drift from enforcement.
4. Add tenant-specific add-ons/overrides only when product and support requirements demonstrate mixed package needs. Until then, simple edition presets are easier to audit. If billing integration is later chosen, translate billing product/feature state into the entitlement interface and reconcile changes idempotently; do not let the payment provider define application authorization.
5. Give temporary rollout flags lifecycle controls (owner, created date, expiry, cleanup tracking) and test the fail-closed/default behavior. Keep entitlement and role checks authoritative even if a flag provider is unavailable.

These recommendations are an inference from the documented patterns above and AlphaCI's current capability/persona investigation, not vendor requirements. GitLab's subscription structure is a useful product analogy; Stripe's model becomes relevant only if AlphaCI adds external billing-driven entitlement updates; OpenFeature is optional infrastructure for rollout, not a prerequisite for an edition catalog.
