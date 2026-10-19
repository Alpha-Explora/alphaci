---
type: "Executive and Implementation Report"
title: "AlphaCI Golden Copy executive and implementation report"
description: "A self-contained, plain-language current-state report and Enterprise-first implementation brief for the AlphaCI frontend."
tags: [executive, product, architecture, governance, enterprise, implementation]
status: stable
---
# AlphaCI Golden Copy executive and implementation report

## Quick summary

- **Current position:** AlphaCI is one product. This repository is the single web UI for that product.
- **Delivery priority:** Enterprise readiness comes first.
- **Approach:** Build shared screens once, then use the same UI for Enterprise, SaaS, and EDU.
- **Main control:** A screen is not called available until it has an owner, working behavior, tests, operating instructions, and a capability status that matches the backend catalog.
**Document purpose:** Give a new reader the full frontend picture without needing prior history or another document.

The Golden Copy is the complete reference set. The backend owns the versioned product catalog package. This frontend keeps a local package fixture, a documentation snapshot, and a surface map of the screens that consume it. This document is the self-contained summary and implementation guide for the UI.

## 1. What this document is

This is a deliberate mix of a **report** and **documentation**.

| Report role | Documentation role |
|---|---|
| Explains where the frontend is today. | Explains how the UI is organized. |
| States what is most important next. | Explains capabilities, packs, operations, and proof. |
| Highlights risks and decisions. | Defines the steps for implementing and checking work. |
| Gives leadership a short, usable view. | Gives delivery teams enough context to work consistently. |

## 2. The simple connection between all the parts

The pieces fit together in this order:

```text
Architecture
  tells us who owns each screen
      ↓
Capability
  tells us what the product can do
      ↓
Pack
  groups capabilities for SaaS, EDU, or Enterprise
      ↓
Runbook
  tells people how to use, check, or support it
      ↓
Evidence
  shows whether the claim is true
      ↓
Report
  summarizes status, priorities, risks, and decisions
```

### Plain-language definitions

| Term | Meaning |
|---|---|
| Architecture | The map of the UI and the feature responsible for each job. |
| Capability | One useful feature or promise the product can provide. |
| Pack | A named group of capabilities for a customer type. |
| Runbook | A step-by-step instruction for operating, checking, or supporting the UI. |
| Evidence | A test, check, or approved real-environment result that supports a claim. |
| Golden Copy | The maintained set of current product, architecture, operating, and evidence records. |
| Executive report | The readable summary of current status, delivery order, risks, and proof. |

The architecture says **where** UI responsibility lives. The capability list says **what** is provided. The packs say **how the capabilities are grouped**. The runbooks say **how the work is operated**. Evidence says **whether the statement is trustworthy**. This report brings those answers together.

Capability keys are not invented here. They are owned by the backend `@alphaci/capability-catalog` package and mirrored into `docs/capabilities/catalog.snapshot.json` for portable documentation.

## 3. Current product shape

AlphaCI is one application with six owned backend areas. The frontend presents those areas through feature domains in one Next.js app.

AlphaCI runs on the customer's own server. One frontend image, built for the Enterprise profile with a same-origin API base, serves every self-hosted customer behind the backend's reverse proxy. Customers keep github.com, GitHub-hosted runners, GHCR, and SonarCloud.

| Product area | Everyday UI responsibility |
|---|---|
| Identity and access | Sign-in, users, workspaces, roles, hierarchy, administration, and session handling. |
| Projects and workflows | Project creation, workflow studio, project detail (code, commits, pull requests, pipeline), QA checklists and test suites, QA Studio, PO Studio acceptance, and iterations. |
| Pipelines and CI | Run history and build-result presentation. |
| Runtime and deployments | Environments, promotion, rollback, hosting targets, on-prem hosts, previews, drift, and provider-backed setup. |
| Billing and usage | No payment UI. Contract billing is assumed. Quota flags may be loaded without a dedicated panel. |
| Platform operations | Notifications, feedback, home, and guide. |

Hosting options (Vercel, Render, and on-prem hosts) are choices inside Runtime. They are not separate versions of the UI.

### Session and API

The browser does not store provider tokens. GitHub and hosting credentials stay in the backend session. The UI calls the backend with `credentials: "include"` so the `cicd_workflow_sid` cookie is sent. The frontend origin must be listed in the backend CORS configuration.

There is no `/subscribe` route. Authenticated users continue to the path they asked for.

## 4. Current capability and pack status

### Capability status

The capability list is shared across all packs. A capability is not copied three times for SaaS, EDU, and Enterprise. Each pack profile lists every current package capability in that same order so the three catalogs can be compared row by row.

| Capability area | What the UI currently covers | Current status |
|---|---|---|
| Identity and access | Sign-in, settings workspaces, Teams and group routes, administration. | Stable catalog keys exist. Hierarchy routes are present; the hierarchy flag is loaded and does not currently hide those routes. SSO/SCIM, LMS/LTI, cohort policy, education provisioning, FERPA workflows, and runtime pack entitlement resolution have no frontend surface. |
| Platform operations | Inbox, notification settings, home, guide, feedback. | Notifications are gated. Audit-event flags are loaded without a dedicated panel. Customer data-location controls have no frontend surface. |
| Billing and usage | No checkout UI. | Usage-quota flags are loaded without a dedicated panel. Self-serve checkout is not implemented. |
| Runtime and hosting | Workflow studio provisioning and project hosting, history, previews, drift, and repair. | Limited; setup and provider support are required. Managed secrets, air-gap packaging, and customer-managed isolation have no frontend surface. |
| Projects and workflows | Project synchronization, workflow preview, workflow update requests, and target management. | Stable or limited depending on the capability and setup. |
| Pipelines and CI | Run history and project run tabs. | Limited; CI setup and reporting are required. GitHub Enterprise Server has no frontend surface. |

### Pack status

Packs are customer-facing groupings and comparison tools. They do not switch screens on and do not create separate frontend logic.

| Pack | What it means | Current status |
|---|---|---|
| SaaS | Shared hosted capabilities for general customers. | Lists the shared catalog. Checkout and runtime pack entitlement resolution are not implemented. Marketing-site behavior is not a frontend capability. |
| EDU | Shared capabilities considered for education environments. | Lists the shared catalog. LMS/LTI, cohort policy, FERPA workflows, education identity provisioning, and runtime pack entitlement resolution are not implemented. |
| Enterprise | Shared capabilities held to stricter access, security, operating, and evidence standards. | Lists the shared catalog under the Enterprise evidence bar. SSO/SCIM, GitHub Enterprise Server, managed secrets, air-gap packaging, data-location controls, customer-managed isolation, and runtime pack entitlement resolution are not implemented. |

The report deliberately distinguishes “described” from “available.” This prevents a pack description from becoming an accidental customer promise.

## 5. Why Enterprise is first

Enterprise customers need confidence that access, delivery, records, recovery, and support will work predictably. These are also good foundations for SaaS and EDU.

Enterprise-first on the frontend means:

1. Protect customer access presentation before adding optional screens.
2. Make hosting, credentials, and recovery controls understandable.
3. Make important actions visible and supportable without hidden knowledge.
4. Build shared screens once so every pack benefits.
5. Keep Enterprise-specific claims honest until they are implemented and proven.

Enterprise-first does not mean creating a separate UI for each pack.

## 6. Enterprise-first implementation order

| Priority | Area | Plain-language goal | Ready when |
|---|---|---|---|
| P0 | Access and customer separation | The right people see the right customer information. | Permission tests, administrative review, and support instructions pass. |
| P0 | Safe delivery and hosting | Hosting and environment screens are controlled and understandable. | Hosting tests, setup checks, and recovery instructions pass where needed. |
| P0 | Records and background work | Important actions are visible in the UI when the backend records them. | Notification, activity, and run presentation tests exist. |
| P1 | Enterprise connections | Add identity, repository, secret, and operating options when the backend provides them. | Product contract, tests, operating instructions, and honest pack status exist. |
| P2 | SaaS and EDU refinement | Improve the other packs using the same shared UI. | Pack comparison, capability status, regression tests, and release history are updated. |

## 7. How every feature will be implemented

Each UI improvement follows the same path:

1. **Describe the outcome.** State what a customer, user, or operator should be able to do.
2. **Name the capability.** Use the shared catalog key. Do not invent a frontend-only key.
3. **Assign one owner.** Choose the feature domain responsible for the screen.
4. **Identify connections.** Note whether it affects access, hosting, data, or another domain.
5. **Build a small complete slice.** Keep the behavior in its owning feature and avoid broad rewrites.
6. **Test success and failure.** Check normal use, permissions, bad input, and hidden-flag states.
7. **Write the operating steps.** Explain how to check or support the behavior.
8. **Update the packs.** Use the same status and limitation language for SaaS, EDU, and Enterprise.
9. **Collect proof.** Run automated checks. Record approved environment checks where local tests are not enough.
10. **Record the change.** Update the architecture record, surface map, pack status, evidence record, change history, and this report when leadership status changes.

## 8. How implementation will happen in parallel

Different feature domains can be built at the same time. What cannot happen in parallel is two teams independently defining the same customer promise, capability key, or hosting rule.

| Workstream | Main responsibility | Main result |
|---|---|---|
| A. Shared definitions | Keep capability names, pack language, ownership rules, and evidence standards consistent with the backend. | One shared vocabulary and current reference. |
| B. Enterprise access | Build sign-in, customer separation, roles, workspaces, hierarchy, and administration screens. | Trusted access behavior and proof. |
| C. Enterprise delivery | Build hosting, environment, credential, and recovery screens. | Controlled delivery presentation. |
| D. Testing and release | Test every stream, protect existing behavior, combine evidence, and prepare release decisions. | Release-ready evidence and honest status. |

### Parallel working rules

1. Agree on the capability name and owner before work begins across areas.
2. Keep one owner for each customer promise and screen.
3. Keep changes small enough to review and combine regularly.
4. Publish shared definition changes before other streams build on them.
5. Keep code, tests, operating instructions, and status updates together.
6. A missing real-environment check lowers the status; it does not justify an unsupported availability claim.
7. Run the shared checks continuously, not only at the end.

## 9. Delivery stages

| Stage | What happens | Exit question |
|---|---|---|
| 0. Common baseline | Record the current UI, shared vocabulary, and status rules. | Can a new reader understand the UI and its current limits? |
| 1. Enterprise foundation | Agree on access, delivery, and proof requirements. | Does every P0 area have an owner and a way to verify it? |
| 2. Parallel build | Workstreams deliver independent slices against the shared definitions. | Does each slice include behavior, tests, operating steps, and status? |
| 3. Combined verification | Test the connections between access, delivery, and support. | Are release-scoped risks visible and addressed? |
| 4. Controlled release | Release the approved scope with honest pack status and usable procedures. | Can the team operate and support what was released? |

## 10. Definition of ready

An item can be called ready only when:

- the customer outcome and capability name are clear;
- one feature domain owns the screen;
- access, hosting, and session effects are understood;
- normal and failure behavior are tested at the right level;
- operating or support steps are written;
- all affected packs use accurate status and limits;
- automated checks are current;
- required real-environment proof is recorded;
- the change history is updated;
- the Enterprise release questions below have acceptable answers.

## 11. Enterprise release questions

Before presenting a capability as Enterprise-ready in the UI, ask:

1. Can each customer and administrator see only what they are allowed to see?
2. Can we explain which backend capability the screen represents?
3. Can we operate and support the screen using clear instructions?
4. Do hidden-flag and error states fail closed rather than showing unsupported controls?
5. Do the capability list and all three packs use the same status and limits as the backend catalog?
6. Is there real-environment proof wherever a written check is not enough?

If any answer is not yet acceptable, the capability remains limited, setup-dependent, or not implemented.

## 12. Risks and controls

| Risk | Level | Control |
|---|---|---|
| The package fixture or snapshot drifts from the backend catalog. | High | Update the reviewed package artifact, refresh the documentation snapshot, and run the package, capability, and documentation checks. |
| Enterprise work becomes a separate UI copy. | High | Build shared screens once and keep one pack and status language. |
| Parallel work creates conflicting definitions. | High | One owner per area and shared contract review before reuse. |
| A compatibility flag is loaded but the screen ignores it. | Medium | Record the gap in the surface map instead of implying the panel is gated. |
| A written check is mistaken for live proof. | Medium | Label local, integrated, and authenticated-environment evidence separately. |

## 13. How the Golden Copy stays current

The Golden Copy is maintained while AlphaCI is being built.

For every material change:

1. Check whether the UI structure, capability, pack status, operating steps, session, risk, or evidence changed.
2. Update the detailed record owned by that area.
3. Update the snapshot and surface map if the customer promise or screen mapping changed.
4. Update operating instructions if people must operate or support the change.
5. Re-run the relevant checks.
6. Update the change history.
7. Update this report when the executive status, Enterprise priority, readiness, risk, or proof changes.

The report should remain readable and portable. The detailed records can contain deeper technical material, but a decision-maker should not need them to understand the current position and delivery order.

## 14. Current evidence and limits

| Area | Current position |
|---|---|
| Product structure | One Next.js application with feature domains mapped to six backend areas. |
| Hosting choices | Vercel, Render, and on-prem hosts appear when the backend advertises them. |
| Capability records | Shared capability names, status, applicability, and dependency edges come from the versioned package and are mirrored for SaaS, EDU, and Enterprise. |
| Pack records | All three packs list the shared catalog. Pack-specific gaps use `not-implemented` or `not-applicable` status. |
| Operating guidance | Verification, session, and self-hosted image procedures are recorded. |
| Automated proof | Document format, naming, generated maps, feature boundaries, capability surfaces, tests, and builds can be checked. |
| Live limits | Authenticated session, provider, and recovery checks require an approved backend environment. |
| Test baseline | There is no accepted failure baseline; the local verification runbook defines the full suite as the gate. |

## Recommended executive actions

1. Use this document as the portable explanation of the current UI and delivery approach.
2. Use the detailed records for implementation and operations, while keeping this report focused on status, priorities, risks, and proof.
3. Keep Enterprise as the acceptance bar for shared access, delivery, and evidence work.
4. Assign clear owners to the parallel workstreams instead of running competing UI rewrites.
5. Do not approve an Enterprise availability claim without implementation, test, operating, and evidence records.
6. Keep SaaS and EDU aligned with shared changes without duplicating UI logic.
7. Review this report at every material release and whenever priority, readiness, risk, or evidence changes.

The Golden Copy is successful when a new reader can understand what the AlphaCI UI is, what it can show, how the packs relate to the capabilities, what is being built first, how work is shared in parallel, and what proof is still required.
