# CLAUDE.md — alphaci-golden-copy-fe

Next.js 16 (App Router, React 19, Tailwind 4) frontend for the ALPHACI CI/CD
platform. Canonical current-state documentation is the OKF bundle under
[`docs/`](docs/index.md). Start with the
[Golden Copy executive report](docs/executive/golden-copy-executive-report.md).
See the workspace root [`../CLAUDE.md`](../CLAUDE.md) for product
context and cross-repo flow, and the backend's `CLAUDE.md` for API details.

npm package name is `cicd-fe-single`; the repo is `Alpha-Explora/alphaci-golden-copy-fe`
(renamed from `alphaci-enterprise-fe`; the local checkout folder still uses the old name).

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
Domains present today: `admin`, `auth`, `capabilities`, `groups`, `guide`,
`home`, `notifications`, `projects`, `runs`, `settings`, `teams`, `workflows`,
`workspace`.

### The rules are enforced, not suggested

| Command | What it checks |
|---------|----------------|
| `npm run boundaries` | dependency-cruiser: layer + cycle rules (see `.dependency-cruiser.cjs`) |
| `npm run arch:check` | `scripts/check-boundaries.mjs`: thin-page, no-http-in-views, one-vm-status, no-react-in-model |
| `npm run arch:check:touched` | the same, but only files changed vs `origin/main` |

Both are **at zero** and there is no known-violations baseline. If you add a
violation, fix the edge — do not re-add a baseline to land it.

The rules in short:

- **`routes-compose-only`** — `src/app/` may import a feature barrel and
  `shared/`, nothing deeper.
- **`no-deep-feature-imports`** — cross-feature imports go through `index.ts`.
  Within your own domain, reach freely into `model/` and `data/`.
- **`views-must-not-fetch`** — `views/` must not import `data/` at runtime.
  Type-only imports are exempt: they are erased and carry no coupling.
- **`no-legacy-source-roots`** — `src/components/`, `src/hooks/`, and
  domain-specific `src/lib/` modules are retired; new code must be owned by a
  feature or by `shared/`.
- **`shared-must-not-know-features`** — `src/shared/` sits below every feature.
- **`no-circular`** — any cycle fails.

### Migration policy

The architecture migration has removed the legacy source roots. Keep routes
thin, import cross-feature code through public barrels, and put new domain UI,
orchestration, and transport in the owning feature slice. Shared code must stay
domain-free.

`scripts/check-boundaries.mjs` and `scripts/lib/paths.mjs` are vendored
byte-identical from the `next-feature-architecture` skill (the skill repo is
read-only; `check-boundaries.mjs` dynamically imports `paths.mjs` at runtime,
which is why both files are here). `scripts/**` is eslint-ignored.

---

## CSS

`src/app/globals.css` is an **import manifest**, not a stylesheet — it went from
13,339 lines to ~1,700. The import order in it is load-bearing:

```css
@import "tailwindcss";
@import "../shared/styles/tokens.css";     /* then reset, typography */
@import "../styles/base.css";              /* then keyframes, theme, surfaces */
@import "../styles/components.css";        /* LAST, deliberately */
```

`components.css` is last because `.glass-panel` must beat `.section-card`,
`.latest-result-banner` and `.team-detail-surface` — equal specificity, so
source order decides. Three classes are still pinned in `globals.css` itself
(`latest-result-banner__eyebrow`, `latest-result-banner__chips`,
`studio-tab-bar--enhanced`); moving them flips a tie.

### Lint tiers

`npm run lint:css` runs stylelint over `src/**/*.css` in tiers
(`stylelint.config.mjs` documents each decision):

| Path | Severity |
|------|----------|
| `src/shared/styles/**` | error — tokens, reset, typography |
| `src/features/**` | error — where new CSS goes |
| `src/styles/**` | **warning**, under a ceiling — lifted out of globals.css |
| `src/components/**` | **warning**, under a ceiling — `hierarchy.css`, predates the split |
| `src/app/globals.css` | ignored — it is a manifest |

The warning tier runs under `--max-warnings=749`, today's exact count. **When
you fix warnings, lower the ceiling in `package.json` in the same commit** —
slack you leave is slack the next person spends.

Three stylelint rules are deliberately overridden. Read the reasoning in
`stylelint.config.mjs` before touching them; each one, obeyed, breaks something:

- `property-no-vendor-prefix` — off. Every hit is a prefix Safari still needs.
- `selector-not-notation: "simple"` — the "complex" form silently drops specificity.
- `declaration-block-no-redundant-longhand-properties` — ignores `overflow`.

### Token debt

`tokens.css` holds 191 tokens; the surface files still carry ~424 raw `rgba()`
and ~117 hex literals. Substituting a token is **not** a no-op:
`--accent-rose-glow` is `rgba(244,63,94,.3)` in dark and `rgba(225,29,72,.15)`
in light, so replacing a literal that matches the dark value changes light
theme. This is a reading job, not a codemod.

**Verifying a CSS refactor:** flatten every changed file to a multiset of
`at-rule context || selector { declarations }` and diff against `HEAD`. Equal
multisets plus unchanged source order is the only real proof a "safe" edit
didn't move a cascade winner.

---

## Data flow rules

- **Never store provider tokens in the browser.** GitHub access token and
  Render/Vercel credentials live only in the BE session and Supabase.
- All GitHub API calls are proxied through the BE. FE talks only to
  `NEXT_PUBLIC_API_URL`.
- No direct Supabase client in the FE.
- Use `credentials: "include"` on every fetch so the session cookie is sent
  cross-origin. Session cookie name is `cicd_workflow_sid`; the FE origin must
  be in the BE's `CORS_ORIGINS`.
- The Create Project UI is catalog-driven — read repo shapes, project types,
  workflow recipes and defaults from the backend rather than hardcoding
  language/workflow combinations.

### Sign-out

Use `useAuthSession().signOut` / `isSigningOut`. Do not call `logout()` and
`refresh()` by hand — three surfaces each had their own copy with its own
`isLoggingOut` flag, and they drifted.

### ViewModel conventions

- One `status` per ViewModel (`arch:check` enforces this). Don't add a second
  loading boolean beside it.
- Guard async resolution with a **request counter**, not just an `active` flag,
  so a slow first request cannot overwrite a fast second one.
- Effects resolve; **handlers** own the loading transition. Setting state
  synchronously inside an effect trips `react-hooks/set-state-in-effect`, and
  every instance of it in this repo turned out to be a real bug.
- Errors returned to views are display strings, never API objects.

---

## Routes

26 routes; 15 static / 11 dynamic at build (plus `/_not-found`). Everything
except `/`, `/login`, `/signup` and `/auth/callback` is a one-line re-export
from a feature.

```
/                                    /admin
/login  /signup  /auth/callback      /admin/feedback
/home                                /admin/users/[id]
/workflows                           /groups/[groupId]
/runs                                /groups/[groupId]/activity
/projects/[projectId]                /groups/[groupId]/members
/projects/[projectId]/qa/report/[runId]
/qa/project-report/[deliveryProjectId]/[runId]
/teams                               /groups/[groupId]/systems
/checklists  /activity               /groups/[groupId]/systems/[systemId]
/settings                            /groups/[groupId]/repositories/[repositoryId]
/inbox                               /groups/[groupId]/delivery-projects/[deliveryProjectId]
/guide
```

The team pages all show the team selected in the header's workspace picker
(the only team selector; one list under "Your teams", sorted by name, where a
platform admin's non-member teams are merged in; a "+" Create team button sits
at the right end of that heading for Team leads and Admins): `/workflows` its Project cards, `/teams` its
members, `/checklists` its QA checklist templates, `/activity` its activity &
audit feed, and `/settings?tab=team` its own settings. `/teams` forwards old
`?section=` links to those pages (`legacyTeamsRedirect` in
`features/teams/model/teams-rules.ts`). The team pages open straight onto
their content card (no hero header; the page's h1 is visually hidden). The
sidebar offers Activity only to whoever the backend lets read the feed — a
Team lead (global app role `lead`) who belongs to the selected team, or an
admin / platform admin. The stored per-team role does not decide; the backend
derives the team role from the app role (`canOpenTeamActivity` in
`features/workspace/selection/model/workspace-types.ts`).

`/runs` is built and wired to the BE run history. (Earlier revisions of this
file said it was blocked on the webhook receiver; it isn't.)

---

## API ownership

`src/shared/api/` owns only generic transport (`request` and `ApiError`). Each
domain's endpoint functions and DTO-facing types live beside its feature
`data/` layer. Other features consume those operations through a domain or
action barrel; routes never import data modules directly.

---

## Billing model

No payment gateway. Entitlement is agreed by contract and granted
administratively: no checkout, no paywall, no `/subscribe`.
`getAuthenticatedRedirectPath` sends every authenticated user to the path they
asked for; only guests are redirected, to `/login`. On the backend,
`SUBSCRIPTION_GATE_ENABLED=false` treats every user as fully entitled.

---

## Conventions

- TypeScript strict; `allowJs: false`. Path aliases: `@/` → `src/`,
  `@shared/` → `src/shared/`, `@features/` → `src/features/`. Existing code
  uses `@/` almost everywhere; prefer it for consistency.
- `"use client"` only where a browser API, state or an event handler needs it.
- Tailwind 4 — no `tailwind.config.js`; configured via CSS.
- No hardcoded API URLs — read `process.env.NEXT_PUBLIC_API_URL`.
- Conventional Commits. Never push to `main` directly.

---

## Config

**`next.config.ts`** — not empty:
- `images.remotePatterns` allows GitHub and Google avatar hosts.
- `turbopack.root` pins the workspace root.
- A `headers()` rule sets `Cache-Control: no-store, must-revalidate` on
  documents, with a negative lookahead excluding `/_next/*` (those are
  content-hashed and must stay immutably cached). Without it the disk/bfcache
  can serve a stale prerendered shell after a redeploy.

**`eslint.config.mjs`** — flat config, extends `eslint-config-next`
core-web-vitals + typescript. Ignores `.next/`, `out/`, `build/`,
`next-env.d.ts` and `scripts/**`. CI runs it with `--max-warnings=0`.

**`jest.config.js`** — jsdom; roots `tests/` and `src/`; setup
`jest.setup.js` (imports `@testing-library/jest-dom`). Coverage excludes
`src/app/**`. Thresholds: **branches 80, functions 90, lines 90, statements 90**.

---

## Testing

```bash
npm test                # jest --runInBand
npm run test:e2e        # tsx tests/e2e/playwright-e2e.ts (a plain Node script)
```

33 test files, ~373 tests. **10 tests in `tests/unit/project-env-panel.test.tsx`
fail on `main`** — a jsdom `element.tagName` null in the suite's own
`changeValue` helper, not a product bug. If your change leaves exactly those 10
failing, you have not broken anything.

`tests/performance/k6-smoke.ts` needs the k6 CLI and is not picked up by
`npm test`.

New `model/` code is the cheap place to add tests — it's pure, so it needs no
DOM. `tests/unit/features/<domain>/model/` follows the feature layout.

---

## Commands

```bash
npm run dev             # next dev --turbopack, port 3000
npm run build           # production build
npm run typecheck       # tsc --noEmit -p tsconfig.typecheck.json
npm run lint            # eslint
npm run lint:css        # stylelint, tiered, with the warning ceiling
npm run boundaries      # dependency-cruiser
npm run arch:check      # MVVM layer checks
npm run arch:new        # scaffold a feature slice (needs the NFA skill on disk)
```

Full local gate, in the order failures are cheapest to read:

```bash
npm run typecheck && npx eslint src --max-warnings=0 && npm run lint:css \
  && npm run boundaries && npm run arch:check && npm test && npm run build
```

Lockfile is `package-lock.json` — use npm. Port 3000 must match `FRONTEND_URL`
in the BE `.env`.

### Key versions

| Package | Version |
|---------|---------|
| `next` | ^16.2.4 |
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

```
NEXT_PUBLIC_API_URL=http://localhost:4000    # BE base URL; must match FRONTEND_URL in BE
```

---

## Docker

Four-stage `Dockerfile` on `node:24-alpine` (`base` → `deps` → `builder` →
`runner`). `base` runs `apk upgrade --no-cache`. `runner` installs with
`--omit=dev`, removes npm/npx from the image, and starts
`node node_modules/next/dist/bin/next start -p 3000`. Exposes 3000.
`.dockerignore` excludes `node_modules`, `.next`, `coverage`, `.git`,
`.github`, `npm-debug.log*`.
