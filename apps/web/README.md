# AlphaCI frontend

This repository contains the AlphaCI frontend: one Next.js App Router deployable with feature-sliced MVVM, a domain-free shared layer, and capability consumption from the backend compatibility API.

AlphaCI runs on the customer's own server. One frontend image, built with `NEXT_PUBLIC_API_BASE_URL=/api/v1` and the Enterprise profile, serves every self-hosted customer behind the backend's Docker Compose and Caddy install. See the [self-hosted frontend image runbook](docs/runbooks/runbook-selfhost.md).

## Documentation

The canonical documentation bundle is the OKF v0.2 tree under [`docs/`](docs/index.md):

- [Constitution](docs/constitution.md) - current invariants and update rules.
- [Executive and implementation report](docs/executive/golden-copy-executive-report.md) - self-contained current position and Enterprise-first implementation program.
- [Current architecture](docs/architecture/current-architecture.md) - source and UI composition.
- [Feature map](docs/architecture/feature-map.generated.md) - feature domains and backend context mapping.
- [On-prem hosts](docs/architecture/onprem-hosts.md) - machine enrollment and environment assignment.
- [Capability contract](docs/capabilities/capability-contract.md) - shared catalog consumption.
- [Composition packs](docs/packs/index.md) - comparable SaaS, EDU, and Enterprise references.
- [Runbooks](docs/runbooks/index.md) - verification, session, and self-hosted image procedures.
- [Changelog](CHANGELOG.md) - repository-level changes.

`CLAUDE.md` is the working guide for coding agents. The backend repository owns the product catalog. This frontend vendors that catalog and records the screens that consume it.

## Development

Install and run the standard verification loop:

```bash
npm ci
npm run typecheck
npx eslint src --max-warnings=0
npm run lint:css
npm run boundaries
npm run arch:check
npm run complexity
npm test
npm run build
npm run check:documentation
```

See the [local verification runbook](docs/runbooks/runbook-local-verification.md) for the complete sequence and evidence expectations.

Local app:

```bash
cp .env.example .env.local
npm run dev
```

The app serves on port 3000, which must match `FRONTEND_URL` in the backend environment. Set `NEXT_PUBLIC_API_BASE_URL` to the backend, usually `http://localhost:4000/api/v1`; the `/api/v1` suffix is added when missing. The value is inlined at build time, so restart the dev server after changing it.

Run a product edition locally with the paired composition variables:

```powershell
npm run dev:saas
npm run dev:edu
npm run dev:enterprise
```

SaaS serves the marketing landing at `/`; EDU and Enterprise redirect `/` to `/login`. To create a production build for one edition, use the matching `build:saas`, `build:edu`, or `build:enterprise` script. The equivalent checked-in environment presets are in [`deploy/env/`](deploy/env/README.md).
