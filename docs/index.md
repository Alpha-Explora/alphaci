---
okf_version: "0.2"
---
# AlphaCI knowledge bundle

This bundle describes AlphaCI as it is today: a NestJS API (`apps/api`) and a Next.js web app (`apps/web`) that run as a managed service or as a self-hosted appliance on the customer's server. Start with the [constitution](constitution.md), then use the architecture, capability, pack, and runbook sections. Product-wide concepts have one document; a concept that belongs to one app sits under that app's folder.

## Foundations

* [Executive and implementation report](executive/) - self-contained current position and Enterprise-first implementation program.
* [Constitution](constitution.md) - executable current-state invariants for both apps.
* [Architecture](architecture/) - API context ownership, contracts, events, providers, routes and schemas; web feature ownership and routes; decisions.
* [Capabilities](capabilities/) - capability contract, generated matrix, surface matrix, and ledger.
* [Packs](packs/) - comparable SaaS, EDU, and Enterprise composition references.
* [Project requirements design](design/project-requirements.md) - Project requirements, Iterations, QA runs, test cases, acceptance, and the merge-to-main gate.
* [Persona workflow design](design/persona-workflow.md) - what Product owners, QA and Developers may each do, branch visibility, pull request routing, and notification fan-out.
* [Runbooks](runbooks/) - verification, self-hosted install, migrations, outbox, provisioning, on-prem hosts, sessions, authentication, and performance procedures.
* [Workspace member notifications](operations/workspace-member-notifications.md) - live delivery, settings, and recipient verification.

## Maintenance

* [Bundle update log](log.md) - OKF documentation-bundle history.
* Code change history is recorded in each app's `CHANGELOG.md`.
* `npm run check:documentation` at the repository root validates this bundle; each app's `generate:architecture-maps` writes its generated maps here.

The bundle uses OKF v0.2 Markdown and YAML frontmatter. `index.md` files are directory listings and `log.md` is update history; all other Markdown files are typed concepts. `plans/` and `specs/` hold dated plans and designs that are not built yet; they are not current-state concepts and the bundle checks skip them.
