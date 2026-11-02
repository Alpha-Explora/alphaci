# AlphaCI monorepo

npm workspaces and Turborepo: `apps/api` (NestJS), `apps/web` (Next.js), shared `packages/*`, and the self-hosted appliance in `deploy/selfhost`. `README.md` covers setup; `apps/api/README.md` and `apps/web/CLAUDE.md` cover each app.

## Documentation

- `docs/` is the only documentation bundle (OKF v0.2). Start at `docs/index.md`. Do not create a `docs/` folder inside an app or package; the root check fails on one.
- A product-wide concept has one document. A concept that belongs to one app goes under `docs/architecture/api/` or `docs/architecture/web/`.
- Docs describe the current state only. Plans and not-yet-built designs go in `docs/plans/` or `docs/specs/`. Delete a plan once it is done, after its lasting decisions are in the current docs (README, ADRs, runbooks); git history keeps the rest.
- `*.generated.md` files and the three `docs/packs/*/pack.md` profiles are generated. Run `npm run generate:architecture-maps -w @alphaci/api` or `-w @alphaci/web`; do not edit them by hand. Pack prose lives in the `PACKS` table of `apps/web/scripts/generate-architecture-maps.mjs`.
- New ADRs continue the one series in `docs/architecture/decisions/` and get a line in its `index.md`.
- A change that alters a documented contract updates the concept, `docs/log.md`, and the changed app's `CHANGELOG.md` in the same pull request.
- `npm run check:documentation` at the root validates the bundle and generated maps, then runs each app's own checks.
