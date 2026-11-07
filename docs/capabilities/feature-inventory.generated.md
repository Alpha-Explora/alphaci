---
type: "Feature Inventory"
title: "Built feature inventory"
description: "Generated feature-level inventory with inherited capability membership and implementation evidence."
tags: [capabilities, features, composition]
status: stable
sources:
  - id: authoring-source
    resource: "apps/api/src/kernel/composition/catalog.source.json"
    title: "Capability and feature authoring source"
---

# Built feature inventory

Generated from the descriptive `features` entries in the capability authoring source. This is a scoped inventory of reconciled behavior, not an exhaustive screen list or proof of live readiness. Capability memberships, maturity and configuration below are inherited; feature entries cannot grant editions or role permissions.

Deployment contracts and web build gates are identified separately. Read the referenced authorization rules and resource checks for allowed actions. Evidence paths identify verification code or operator procedures, not a claim those checks have run in a particular deployment. Historical origin, when supplied, is descriptive and does not determine membership.

| Feature | Composition owner | Declared applicability | Capability status or controlling contract |
|---|---|---|---|
| Project requirements and developer progress (`projects.requirements`) | `projects.qa-checklists` | saas, edu, enterprise | limited; qaChecklists.enabled |
| User-story test cases and QA execution (`projects.qa-test-cases`) | `projects.qa-checklists` | saas, edu, enterprise | limited; qaChecklists.enabled |
| Project QA runs, screenshot evidence, and sign-off (`projects.qa-runs`) | `projects.qa-checklists` | saas, edu, enterprise | limited; qaChecklists.enabled |
| PO acceptance and controlled merge to production (`projects.po-acceptance`) | `projects.release-governance` | saas, edu, enterprise | limited; releaseGovernance.enabled; existing QA and workflow safety gates remain mandatory |
| Iteration delivery and carry-forward (`projects.iterations`) | `projects.release-governance` | saas, edu, enterprise | limited; releaseGovernance.enabled; existing QA and workflow safety gates remain mandatory |
| Customer host inventory, enrollment, and assignment (`runtime.hosts`) | `runtime.managed-host-delivery` | saas, edu, enterprise | limited; managedHostDelivery.enabled plus on-prem operator configuration |
| Signed host release delivery, promotion, and rollback (`runtime.signed-delivery`) | `runtime.managed-host-delivery` | saas, edu, enterprise | limited; managedHostDelivery.enabled plus on-prem operator configuration |
| Live workspace membership notifications (`platform.live-membership-notifications`) | `platform.notifications` | saas, edu, enterprise | stable; notifications.enabled |
| SaaS public landing pages (`platform.public-landing`) | Web build gate | saas build | UI implementation; not an API capability availability claim |
| Single-server AlphaCI appliance (`runtime.selfhost-appliance`) | Deployment contract | Independent of edition | `selfhosted`; no separate capability grant |
| Enterprise client-composition settings (`runtime.client-policy`) | `runtime.client-composition` | enterprise | limited; composition.client.enabled and an Enterprise client policy source |

## Project requirements and developer progress

- Identifier: `projects.requirements`.
- Implementation: `apps/api/src/modules/projects/api/qa-requirements.controller.ts`.
- Authorization references: `apps/api/src/kernel/rules/persona-access.rules.ts`<br>`apps/api/src/modules/projects/domain/qa-run-access.rules.ts`.
- Prerequisites: Project membership and current iteration; action-specific persona rules.
- Evidence: `apps/api/src/modules/projects/api/qa-requirements.controller.spec.ts`.

## User-story test cases and QA execution

- Identifier: `projects.qa-test-cases`.
- Implementation: `apps/api/src/modules/projects/api/qa-checklists.controller.ts`<br>`apps/api/src/modules/projects/api/qa-project-runs.controller.ts`.
- Authorization references: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`.
- Prerequisites: Project access; QA or admin owns test-case authoring and results.
- Evidence: `apps/api/src/modules/projects/api/qa-checklists.controller.spec.ts`<br>`apps/api/src/modules/projects/domain/qa-run-access.rules.spec.ts`.

## Project QA runs, screenshot evidence, and sign-off

- Identifier: `projects.qa-runs`.
- Implementation: `apps/api/src/modules/projects/api/qa-project-runs.controller.ts`<br>`apps/api/src/modules/projects/api/qa-run-attachments.controller.ts`.
- Authorization references: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`.
- Prerequisites: Repository access and deployed UAT heads; verification and sign-off preconditions.
- Evidence: `apps/api/src/modules/projects/api/qa-runs.controller.spec.ts`<br>`apps/api/src/modules/projects/api/qa-run-attachments.controller.spec.ts`.

## PO acceptance and controlled merge to production

- Identifier: `projects.po-acceptance`.
- Implementation: `apps/api/src/modules/projects/api/qa-runs.controller.ts`.
- Authorization references: `apps/api/src/modules/projects/domain/qa-run-access.rules.ts`.
- Prerequisites: Lead or admin; signed-off run, accepted items, and promotion gate.
- Evidence: `apps/api/src/modules/projects/api/qa-runs.controller.spec.ts`<br>`apps/api/src/modules/projects/domain/qa-run-access.rules.spec.ts`.
- Origin: [3c9820c2](https://github.com/Alpha-Explora/alphaci/commit/3c9820c24ab41fd89e0e5c4d268f5ab3595c3db1).

## Iteration delivery and carry-forward

- Identifier: `projects.iterations`.
- Implementation: `apps/api/src/modules/projects/api/project-iterations.controller.ts`.
- Authorization references: `apps/api/src/modules/projects/application/qa-checklists/qa-access.service.ts`.
- Prerequisites: Project manager; current iteration delivered before starting the next.
- Evidence: `apps/api/src/modules/projects/api/project-iterations.controller.spec.ts`<br>`apps/api/src/modules/projects/application/qa-runs/project-iteration-start.service.spec.ts`.

## Customer host inventory, enrollment, and assignment

- Identifier: `runtime.hosts`.
- Implementation: `apps/api/src/modules/runtime/api/onprem-hosts.controller.ts`<br>`apps/api/src/modules/runtime/api/onprem-enrollment.controller.ts`<br>`apps/web/src/app/(platform)/hosts/page.tsx`.
- Authorization references: `apps/api/src/modules/runtime/application/onprem/onprem-hosts.service.ts`<br>`apps/api/src/modules/runtime/api/onprem-enrollment.controller.ts`.
- Prerequisites: Workspace access for user APIs; short-lived enrollment code or machine credential for agent APIs; on-prem configuration.
- Evidence: `apps/api/src/modules/runtime/application/onprem/onprem-hosts.service.spec.ts`<br>`docs/runbooks/runbook-onprem-host-setup.md`.

## Signed host release delivery, promotion, and rollback

- Identifier: `runtime.signed-delivery`.
- Implementation: `apps/api/src/modules/runtime/api/environment-releases.controller.ts`<br>`apps/api/src/modules/runtime/api/onprem-agent.controller.ts`<br>`apps/api/src/modules/runtime/api/releases.controller.ts`.
- Authorization references: `apps/api/src/modules/runtime/domain/release-access.rules.ts`<br>`apps/api/src/modules/runtime/api/onprem-agent.controller.ts`.
- Prerequisites: Release signing, registry credentials, host readiness, and separate CI or machine authentication.
- Evidence: `apps/api/src/modules/runtime/application/release-registry.host-gating.spec.ts`<br>`apps/api/src/modules/runtime/domain/release-signature.spec.ts`.
- Origin: [8f432993](https://github.com/Alpha-Explora/alphaci/commit/8f43299315b847af14aa4a993a3f33de88e3baeb).

## Live workspace membership notifications

- Identifier: `platform.live-membership-notifications`.
- Implementation: `apps/api/src/modules/platform-ops/notifications/api/notifications.controller.ts`<br>`apps/web/src/features/notifications/data/notifications-stream.ts`.
- Authorization references: `apps/api/src/modules/platform-ops/notifications/application/notifications.service.ts`.
- Prerequisites: Authenticated recipient; notifications enabled; stream with fetch fallback.
- Evidence: `apps/api/src/modules/platform-ops/notifications/application/notification-stream.service.spec.ts`<br>`docs/operations/workspace-member-notifications.md`.

## SaaS public landing pages

- Identifier: `platform.public-landing`.
- Implementation: `apps/web/src/app/page.tsx`<br>`apps/web/src/features/public-site/landing/views/landing-view.tsx`.
- Authorization references: `apps/web/src/shared/composition/build-profile.ts`.
- Prerequisites: SaaS web build; platform.public-site remains unimplemented as an API capability.
- Evidence: `apps/web/tests/unit/app/root-edition-gate.test.ts`.

## Single-server AlphaCI appliance

- Identifier: `runtime.selfhost-appliance`.
- Implementation: `deploy/selfhost/compose.yaml`<br>`deploy/selfhost/alphaci-ctl`.
- Authorization references: `apps/api/src/kernel/config/deployment-mode.ts`<br>`docs/runbooks/runbook-selfhost-install.md`.
- Prerequisites: Customer-operated server, PostgreSQL, configured identity and signer; not an air-gap capability claim.
- Evidence: `apps/api/tests/unit/deploy/selfhost-compose.spec.ts`<br>`docs/runbooks/runbook-selfhost-install.md`.
- Origin: [4f292c14](https://github.com/Alpha-Explora/alphaci/commit/4f292c1449df8c09ecd18bcd7ebc53bc39abb95d).

## Enterprise client-composition settings

- Identifier: `runtime.client-policy`.
- Implementation: `apps/api/src/packs/enterprise/client-policy-source.ts`<br>`apps/web/src/features/settings/client-composition/views/enterprise-client-composition-settings-view.tsx`.
- Authorization references: `apps/api/src/packs/enterprise/client-policy.ts`.
- Prerequisites: Selected deployment client policy; deny-only narrowing, not per-tenant edition selection.
- Evidence: `apps/api/src/modules/identity-access/capabilities/api/capabilities.controller.client-composition.spec.ts`.

The [capability contract](capability-contract.md) defines composition. The [feature assignment runbook](../runbooks/runbook-feature-assignment.md) describes authoring and verification. Regenerate with `npm run generate:architecture-maps -w @alphaci/api`.
