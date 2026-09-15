---
okf_version: "0.2"
---
# AlphaCI frontend knowledge bundle

This bundle describes the current AlphaCI frontend as one Next.js deployable. It uses the same Golden Copy vocabulary as the backend: architecture, capability, pack, runbook, evidence, and report. The backend repository owns the product catalog package. This frontend keeps a local package fixture, a documentation snapshot, and a surface map for the screens that consume it.

## Foundations

* [Executive and implementation report](executive/) - self-contained current UI position and Enterprise-first implementation program.
* [Constitution](constitution.md) - executable current-state invariants.
* [Architecture](architecture/) - feature ownership, routes, checks, and decisions.
* [Capabilities](capabilities/) - package consumption contract, documentation snapshot, and generated matrix.
* [Packs](packs/) - comparable SaaS, EDU, and Enterprise composition references.
* [Runbooks](runbooks/) - verification and session procedures.

## Maintenance

* [Bundle update log](log.md) - documentation-bundle history.
* Repository change history is recorded in the root `CHANGELOG.md`.

Dated notes under `docs/superpowers/` are outside this current-state bundle.

The bundle uses OKF v0.2 Markdown and YAML frontmatter. `index.md` files are directory listings and `log.md` is update history; all other Markdown files are typed concepts.
