# CLAUDE.md — alphaci-golden-copy-fe

Next.js 16 (App Router, React 19, Tailwind 4) frontend for the AlphaCI CI/CD
platform. Canonical current-state documentation is the OKF bundle under
[`docs/`](docs/index.md). Start with the
[Golden Copy executive report](docs/executive/golden-copy-executive-report.md).
Product context and the self-hosted direction are in the workspace `AGENTS.md`
at the Alpha Explora workspace root (outside this repository). API details are
in the backend repository `Alpha-Explora/alphaci-golden-copy-be` (its `README.md`
and `docs/` bundle).

npm package name is `cicd-fe-single`; the repo is `Alpha-Explora/alphaci-golden-copy-fe`.

---

## Product shape

AlphaCI runs on the customer's own server. One frontend image serves every
self-hosted customer: it is built with `NEXT_PUBLIC_API_BASE_URL=/api/v1` and
the `enterprise` profile and edition, and sits behind Caddy on the same origin
as the backend (see [Self-hosted frontend image](docs/runbooks/runbook-selfhost.md)).
The same code still builds the hosted SaaS and EDU editions.

What the UI covers today, by feature domain:

- `projects` — the project page tabs: Overview, Code (file browser, browse at a
  commit, branch creation, a switch between the Project's repositories),
  Commits, Pull requests, Checklists, Pipeline (runs grouped by commit),
  Hosting (environments, promotion, deploy rollback), QA Studio, PO Studio,
  Audit, History (releases), Settings. Projects link to deployed sites only,
  never to Vercel/Render dashboards or GitHub.
- `checklists` — QA checklists and test suites (test cases under each user
  story), QA Studio verification runs with evidence and sign-off, PO Studio
  acceptance and merge to main, iterations, and QA reports.
- `workflows` — the Create project wizard (one or two repositories; Vercel /
  Render, on-prem host, or CI only) and the workflow studio.
- `hosts` — on-prem machine enrollment and environment assignment
  ([contract](docs/architecture/onprem-hosts.md)).
- `notifications` — Inbox and live notifications (an `EventSource` stream with
  periodic fallback), including workspace membership alerts.
- `teams`, `groups`, `workspace`, `home`, `runs`, `settings`, `admin`, `auth`,
  `capabilities`, `guide`, `public-site` — see the
  [feature map](docs/architecture/feature-map.generated.md).

---

## Architecture: feature-sliced MVVM

This is the thing to understand before changing anything. Routes under `src/app/`
are a **routing table**, not a place for code. Almost every one is a single line:

```tsx
export { RunsListView as default } from "@/features/runs/list";
```

Business logic lives in `src/features/<domain>/<action>/`:

```
src/features/runs/
├── model/          pure rules + types. No React, no fetch, no Next.
├── data/           the ONLY place in the domain that does I/O.
└── list/
    ├── view-models/   state, effects, orchestration. Owns one `status`.
    ├── views/         renders what the ViewModel gives it.
    └── index.ts       the slice's public API — the only legal import path.
```

`model/` and `data/` sit at domain level because sibling actions share them.
Domains present today: `admin`, `auth`, `capabilities`, `checklists`, `groups`,
`guide`, `home`, `hosts`, `notifications`, `projects`, `public-site`, `runs`,
`settings`, `teams`, `workflows`, `workspace`.

`src/shared/` holds domain-free code only: `api/` (transport, wire contracts,
the API proxy rewrite), `browser/`, `composition/` (build profile and edition),
`layout/`, `styles/` (tokens, reset, typography) and `ui/`.

### The rules are enforced, not suggested

| Command | What it checks |
|---------|----------------|
| `npm run boundaries` | dependency-cruiser: layer + cycle rules (see `.dependency-cruiser.cjs`) |
| `npm run arch:check` | `scripts/check-boundaries.mjs`: thin-page, no-http-in-views, no-react-in-model, one-vm-status (warning) |
| `npm run arch:check:touched` | the same, but only files changed vs `origin/main` |

Both are **at zero** and there is no known-violations baseline. If you add a
violation, fix the edge — do not add a baseline to land it.

The dependency-cruiser rules in short:

- **`routes-compose-only`** — `src/app/` may import a feature barrel and
  `shared/`, nothing deeper.
- **`no-deep-feature-imports`** — cross-feature imports go through `index.ts`.
  Within your own domain, reach freely into `model/` and `data/`.
- **`views-must-not-fetch`** — `views/` must not import `data/` at runtime.
  Type-only imports are exempt: they are erased and carry no coupling.
- **`no-legacy-source-roots`** — `src/components/`, `src/hooks/`, and
  domain-specific `src/lib/` modules do not exist; new code is owned by a
  feature or by `shared/`.
- **`shared-must-not-know-features`** — `src/shared/` sits below every feature.
- **`no-circular`** — any cycle fails.

Keep routes thin, import cross-feature code through public barrels, and put new
domain UI, orchestration, and transport in the owning feature slice. Update
every consumer in the same change; do not leave deep-import shims.

`scripts/check-boundaries.mjs` and `scripts/lib/paths.mjs` are vendored
byte-identical from the `next-feature-architecture` skill (the skill repo is
private; `check-boundaries.mjs` dynamically imports `paths.mjs` at runtime,
which is why both files are here). `scripts/**` is eslint-ignored.

---

## CSS

`src/app/globals.css` (~1,600 lines) starts with an import manifest. The import
order is load-bearing:

```css
@import "tailwindcss";
@import "../shared/styles/tokens.css";     /* then reset, typography */
@import "../styles/base.css";              /* then keyframes, theme, page stylesheets */
@import "../features/projects/...css";     /* four feature-owned sheets */
@import "../styles/components.css";        /* LAST, deliberately */
```

`components.css` is last because `.glass-panel` must beat `.section-card`,
`.latest-result-banner` and `.team-detail-surface` — equal specificity, so
source order decides. Two classes are still pinned in `globals.css` itself
(`latest-result-banner__eyebrow`, `latest-result-banner__chips`); moving them
flips a tie. Other feature CSS sits beside its views
(`src/features/**/views/*.css`) and is imported by the view that uses it.

### Lint tiers

`npm run lint:css` runs stylelint over `src/**/*.css` in tiers
(`stylelint.config.mjs` documents each decision):

| Path | Severity |
|------|----------|
| `src/shared/styles/**` | error — tokens, reset, typography |
| `src/features/**` | error — where new CSS goes |
| `src/styles/**` | **warning**, under a ceiling — lifted out of globals.css |
| `src/app/globals.css` | ignored |

The warning tier runs under `--max-warnings=715` in `package.json` (714
warnings today). **When you fix warnings, lower the ceiling in `package.json`
in the same commit** — slack you leave is slack the next person spends.

Three stylelint rules are deliberately overridden. Read the reasoning in
`stylelint.config.mjs` before touching them; each one, obeyed, breaks something:

- `property-no-vendor-prefix` — off. Every hit is a prefix Safari still needs.
- `selector-not-notation: "simple"` — the "complex" form silently drops specificity.
- `declaration-block-no-redundant-longhand-properties` — ignores `overflow`.

### Token debt

`src/shared/styles/tokens.css` holds the design tokens; the `src/styles/` files
still carry hundreds of raw `rgba()` and ~120 hex literals. Substituting a
token is **not** a no-op: `--accent-rose-glow` is `rgba(244,63,94,.3)` in dark
and `rgba(225,29,72,.15)` in light, so replacing a literal that matches the
dark value changes light theme. This is a reading job, not a codemod.

**Verifying a CSS refactor:** flatten every changed file to a multiset of
`at-rule context || selector { declarations }` and diff against `HEAD`. Equal
multisets plus unchanged source order is the only real proof a "safe" edit
didn't move a cascade winner.

---

## Data flow rules

- **Never store provider tokens in the browser.** GitHub access tokens and
  Render/Vercel credentials live only in the backend.
- All GitHub API calls are proxied through the backend. The FE talks only to
  the API base (`NEXT_PUBLIC_API_BASE_URL`).
- No direct Supabase or database client in the FE.
- `src/shared/api/request.ts` sends `credentials: "include"` on every call so
  the session cookie `cicd_workflow_sid` is sent. On a separate origin the FE
  origin must be in the backend's `ALLOWED_ORIGINS` (and `FRONTEND_URL`).
- The Create Project UI is catalog-driven — read repo shapes, project types,
  workflow recipes, defaults and on-prem service runtimes (`serviceRuntime`)
  from the backend rather than hardcoding them.

### API base URL

`request.ts` resolves the base once, at module load:
`NEXT_PUBLIC_API_BASE_URL`, else the legacy `NEXT_PUBLIC_API_URL` (with a
production warning), else `http://localhost:4000` (with a production error).
A value without `/api/v1` gets it appended. `NEXT_PUBLIC_*` values are inlined
at build time, so changing one needs a rebuild.

Relative `/api/v1` means same origin: the self-hosted image relies on Caddy to
route `/api/*` to the backend. On a hosted deployment, `API_PROXY_TARGET`
(build time) makes this Next.js server proxy `/api/v1/*` to the backend
(`src/shared/api/api-proxy-rewrites.ts`) so the cookie is first-party.

### Sign-in and sign-out

The login page links to `<api>/auth/github/start?returnTo=<fe>/auth/callback?...`;
the backend runs GitHub OAuth, sets the cookie and redirects back. `/auth/me`
returns the session. Use `useAuthSession().signOut` / `isSigningOut` for
sign-out; do not call `logout()` and `refresh()` by hand.

### ViewModel conventions

- One `status` per ViewModel (`arch:check` warns otherwise). Don't add a second
  loading boolean beside it.
- Guard async resolution with a **request counter**, not just an `active` flag,
  so a slow first request cannot overwrite a fast second one.
- Effects resolve; **handlers** own the loading transition. Setting state
  synchronously inside an effect trips `react-hooks/set-state-in-effect`, and
  every instance of it in this repo turned out to be a real bug.
- Errors returned to views are display strings, never API objects.

---

## Routes

28 pages plus the `/healthz` route handler. Everything except `/`, `/login`,
`/signup` and `/auth/callback` is a one-line re-export from a feature. The
generated [route map](docs/architecture/route-map.generated.md) is the full list.

```
/                     SaaS landing (public-site) or redirect to /login
/login  /signup  /auth/callback      /healthz (liveness, no backend call)
/home  /inbox  /guide  /settings     /admin  /admin/feedback  /admin/users/[id]
/workflows  /teams  /checklists  /activity  /hosts
/runs  /runs/report
/projects/[projectId]                /projects/[projectId]/qa/report/[runId]
/qa/project-report/[deliveryProjectId]/[runId]
/groups/[groupId]  .../activity  .../members  .../systems  .../systems/[systemId]
/groups/[groupId]/repositories/[repositoryId]
/groups/[groupId]/delivery-projects/[deliveryProjectId]
```

Route groups `(access)`, `(public)` and `(platform)` only organize files; they
do not change URLs. There is no shared `(platform)/layout.tsx`.

The team pages all show the team selected in the header's workspace picker
(the only team selector; one list under "Your teams", sorted by name, where a
platform admin's non-member teams are merged in; a "+" Create team button sits
at the right end of that heading for Team leads and Admins): `/workflows` its
Project cards, `/teams` its members, `/checklists` its QA checklist templates,
`/activity` its activity & audit feed, and `/settings?tab=team` its own
settings. `/teams` forwards old `?section=` links to those pages
(`legacyTeamsRedirect` in `features/teams/model/teams-rules.ts`). The sidebar
offers Activity only to whoever the backend lets read the feed — a Team lead
(global app role `lead`) who belongs to the selected team, or an admin /
platform admin (`canOpenTeamActivity` in
`features/workspace/selection/model/workspace-types.ts`).

---

## API ownership

`src/shared/api/` owns generic transport (`request`, `ApiError`,
`getApiBaseUrl`) and the shared wire types in `contracts.ts`. Each domain's
endpoint functions live in its feature `data/` layer. Other features consume
those operations through a domain or action barrel; routes never import data
modules directly.

---

## Billing model

No payment gateway. Entitlement is agreed by contract and granted
administratively: no checkout, no paywall, no `/subscribe`.
`getAuthenticatedRedirectPath` sends every authenticated user to the path they
asked for; only guests are redirected, to `/login`. On the backend,
`SUBSCRIPTION_GATE_ENABLED=false` treats every user as fully entitled.

---

## Composition

`ALPHACI_BUILD_PROFILE` (`hosted` | `enterprise`, default `enterprise`) and
`ALPHACI_EDITION` (`saas` | `edu` | `enterprise`) are read by `next.config.ts`
at build time and inlined as `NEXT_PUBLIC_ALPHACI_*`. The profile decides which
feature barrels compile; excluded barrels are aliased to `notFound()` stubs
written to `.capability-stubs/` from the vendored
`vendor/@alphaci/capability-catalog`. Only the `saas` edition serves the
landing page at `/`. Runtime capability flags come from
`GET /api/v1/capabilities`; source code never branches on edition.

---

## Conventions

- TypeScript strict; `allowJs: false`. Path aliases: `@/` → `src/`,
  `@shared/` → `src/shared/`, `@features/` → `src/features/`,
  `@alphaci/capability-catalog` → `vendor/@alphaci/capability-catalog`.
  Existing code uses `@/` almost everywhere; prefer it.
- `"use client"` only where a browser API, state or an event handler needs it.
- Tailwind 4 — no `tailwind.config.js`; configured via CSS.
- No hardcoded API URLs — use `getApiBaseUrl()` / `request`.
- Production functions stay at cyclomatic complexity ≤ 10 (ESLint `complexity`
  on `src/**`; `npm run complexity` is the audit). Views are not exempt.
- Conventional Commits. Never push to `main` directly.

---

## Config

**`next.config.ts`**:
- `env` injects `NEXT_PUBLIC_ALPHACI_BUILD_PROFILE` / `NEXT_PUBLIC_ALPHACI_EDITION`.
- Resolves the build profile from the vendored catalog and aliases excluded
  feature barrels (webpack `resolve.alias`, `turbopack.resolveAlias`).
- `rewrites()` adds the `/api/v1/*` proxy when `API_PROXY_TARGET` is set at build.
- `images.remotePatterns` allows GitHub and Google avatar hosts.
- `turbopack.root` pins the project root.
- A `headers()` rule sets `Cache-Control: no-store, must-revalidate` on
  documents, with a negative lookahead excluding `/_next/*` (those are
  content-hashed and must stay immutably cached).

**`eslint.config.mjs`** — flat config, extends `eslint-config-next`
core-web-vitals + typescript. Ignores `.next/`, `.capability-stubs/`, `out/`,
`build/`, `coverage/`, `next-env.d.ts` and `scripts/**`. `_`-prefixed names
are allowed unused. CI runs `npx eslint src --max-warnings=0`.

**`jest.config.js`** — `next/jest`, jsdom; roots `tests/` and `src/`; setup
`jest.setup.js` (imports `@testing-library/jest-dom`). Coverage is always
collected; it excludes `src/app/**`, `src/shared/layout/**`, `src/shared/ui/**`
and feature `views/**` (except two tracked views). Global floor: **branches 47,
functions 42, lines 50, statements 47**.

---

## Testing

```bash
npm test                # jest --runInBand (whole suite, with coverage)
npm run test:e2e        # tsx tests/e2e/playwright-e2e.ts (a plain Node script)
```

Tests live in `tests/unit/` (`tests/unit/features/<domain>/...` follows the
feature layout) and beside source as `*.test.ts(x)` / `*.spec.ts` under `src/`.
`tests/performance/k6-smoke.ts` needs the k6 CLI and is not picked up by
`npm test`. There is no accepted failure baseline: a failing test is a failure
to fix, not a known count to compare against.

New `model/` code is the cheap place to add tests — it's pure, so it needs no
DOM.

---

## Commands

```bash
npm run dev             # next dev --turbopack, port 3000
npm run dev:enterprise  # also dev:saas, dev:edu — sets profile + edition
npm run build           # next build --webpack
npm run build:profile -- --profile enterprise   # build + profile exclusion check
npm run typecheck       # tsc --noEmit -p tsconfig.typecheck.json
npm run lint            # eslint
npm run lint:css        # stylelint, tiered, with the warning ceiling
npm run boundaries      # dependency-cruiser
npm run arch:check      # MVVM layer checks
npm run complexity      # cyclomatic complexity audit
npm run arch:new        # scaffold a feature slice (needs the NFA skill on disk)
npm run check:documentation       # OKF, naming, stale claims, generated maps
npm run generate:architecture-maps  # regenerate docs/**/*.generated.md and pack files
```

Full local gate, in the order failures are cheapest to read:

```bash
npm run typecheck && npx eslint src --max-warnings=0 && npm run lint:css \
  && npm run boundaries && npm run arch:check && npm test && npm run build \
  && npm run check:documentation
```

CI (`.github/workflows/boundaries.yml`, Node 24) also runs the capability
package, capability surface and build-profile checks, both profile builds, and
`npm run complexity`.

Lockfile is `package-lock.json` — use npm. Port 3000 must match `FRONTEND_URL`
in the backend `.env`.

### Key versions

| Package | Version |
|---------|---------|
| `next` | ^16.3.3 |
| `react` / `react-dom` | ^19.2.5 |
| `tailwindcss` | ^4.2.4 |
| `typescript` | ^6.0.3 |
| `framer-motion` | ^12.38.0 |
| `jest` | ^30.3.0 |
| `stylelint` | ^17.14.1 |
| `dependency-cruiser` | ^18.2.0 |
| `playwright` | ^1.59.1 |

---

## Environment

See `.env.example`. All values are read at build time.

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1  # backend API base; /api/v1 is appended if missing
# API_PROXY_TARGET=https://api.example.com             # optional same-origin proxy (hosted only)
NEXT_PUBLIC_USE_MOCK=false                             # true = runs list from a local fixture
NEXT_PUBLIC_DEV_QUICK_LOGIN=false                      # local dev only; backend needs DEV_QUICK_LOGIN=true
ALPHACI_BUILD_PROFILE=enterprise                       # hosted | enterprise
ALPHACI_EDITION=enterprise                             # saas | edu | enterprise
```

`NEXT_PUBLIC_API_URL` is a legacy alias for the API base.

---

## Docker

Four-stage `Dockerfile` on `node:24-alpine` (`base` → `deps` → `builder` →
`runner`). `base` runs `apk upgrade --no-cache`. `builder` takes build args
`NEXT_PUBLIC_API_BASE_URL`, `ALPHACI_BUILD_PROFILE` and `ALPHACI_EDITION`, and
pins `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_DEV_QUICK_LOGIN=false`.
`runner` installs with `--omit=dev`, removes npm/npx, copies `.next`, `public`
and the `next.config.ts` closure (`next start` loads it again), and starts
`node node_modules/next/dist/bin/next start -p 3000`. Exposes 3000. A
`HEALTHCHECK` calls `GET /healthz` with Node's `fetch` every 30 s.
`.dockerignore` excludes `node_modules`, `.next`, `.capability-stubs`,
`coverage`, `.git`, `.github`, `npm-debug.log*`, and local settings and
credentials: `.env*` (except `.env.example`), `*.pem`, `.claude`,
`.worktrees`, `.temp`, `.tmp`, `.cache`, `.pnpm-store`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
