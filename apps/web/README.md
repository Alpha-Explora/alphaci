# AlphaCI frontend

This repository contains the current AlphaCI frontend: one Next.js App Router deployable with feature-sliced MVVM, a domain-free shared layer, and capability consumption from the backend compatibility API.

## Documentation

The canonical documentation bundle is the OKF v0.2 tree under [`docs/`](docs/index.md):

- [Constitution](docs/constitution.md) - current invariants and update rules.
- [Executive and implementation report](docs/executive/golden-copy-executive-report.md) - self-contained current position and Enterprise-first implementation program.
- [Current architecture](docs/architecture/current-architecture.md) - source and UI composition.
- [Feature map](docs/architecture/feature-map.generated.md) - feature domains and backend context mapping.
- [Capability contract](docs/capabilities/capability-contract.md) - shared catalog consumption.
- [Composition packs](docs/packs/index.md) - comparable SaaS, EDU, and Enterprise references.
- [Runbooks](docs/runbooks/index.md) - verification and session procedures.
- [Changelog](CHANGELOG.md) - repository-level changes.

The backend repository owns the product catalog. This frontend snapshots that catalog and records the screens that consume it.

## Development

Install and run the standard verification loop:

```bash
npm ci
npm run typecheck
npx eslint src --max-warnings=0
npm run lint:css
npm run boundaries
npm run arch:check
npm test
npm run build
npm run check:documentation
```

See the [local verification runbook](docs/runbooks/runbook-local-verification.md) for the complete sequence and evidence expectations.

Local app:

```bash
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` to the backend origin, usually `http://localhost:4000`. Port 3000 must match `FRONTEND_URL` in the backend environment.
