# Architecture

## API (`apps/api`)

* [Current architecture](api/current-architecture.md) - current one-deployable source and deployment composition.
* [Bounded context map](api/context-map.generated.md) - generated context ownership and measured source inventory.
* [Context contracts](api/context-contracts.md) - current public indexes, ports, and directional edges.
* [Project environments](api/project-environments.md) - ordered project environments, per-environment deployment targets, and the creation pipeline.
* [Release registry](api/release-registry.md) - immutable releases, signed on-prem manifests, promotion, rollback, and the host polling contract.
* [Event and outbox map](api/events-map.generated.md) - current topics, owners, handlers, and delivery semantics.
* [Provider map](api/provider-map.generated.md) - current Runtime provider plugins and composition.
* [HTTP route map](api/route-map.generated.md) - generated current API route inventory.
* [Schema ownership map](api/schema-ownership.generated.md) - generated schema owners and exact transition references.
* [Architecture check map](api/architecture-checks.generated.md) - generated metrics and verification commands.

## Web (`apps/web`)

* [Current architecture](web/current-architecture.md) - current one-deployable source and UI composition.
* [On-prem hosts](web/onprem-hosts.md) - workspace machine enrollment and environment assignment.
* [Feature map](web/feature-map.generated.md) - generated feature domains and backend context mapping.
* [Route map](web/route-map.generated.md) - generated App Router inventory.
* [Architecture check map](web/architecture-checks.generated.md) - generated metrics and verification commands.

## Decisions

* [Decision records](decisions/) - accepted current architecture decisions for both apps.
