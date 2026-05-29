# CLAUDE.md — cicd-workflow-fe

Next.js 16 (app router, React 19, Tailwind 4) frontend for the CI/CD-as-a-Service SaaS. See the workspace root [`../CLAUDE.md`](../CLAUDE.md) for product context and cross-repo flow, and [`../cicd-workflow-be/CLAUDE.md`](../cicd-workflow-be/CLAUDE.md) for API details.

---

## Current state

All MVP product surfaces are built and functional. Auth, billing, dashboard, and Create Project are wired to the backend API.

### Built pages

| Route | Status | Description |
|-------|--------|-------------|
| `/` | Built | Landing page with auth-aware CTAs |
| `/login` | Built | GitHub + Google OAuth via `OAuthAuthPage` |
| `/signup` | Built | Same component as login, signup-labelled |
| `/auth/callback` | Built | OAuth callback handler; routes by subscription state |
| `/home` | Built | Dashboard: KPI cards, recent workflows, quick actions; gates on active subscription |
| `/subscribe` | Built | Plan comparison (Pro ₱300, Enterprise ₱1200); mock activate/cancel; `actionError` shown on failure |
| `/workflows` | Built | 3-tab Create Project surface (Setup, Current Projects, Catalog); gates on active subscription |

### Built components

| Component | Description |
|-----------|-------------|
| `OAuthAuthPage` | Shared login/signup OAuth page with GitHub + Google buttons |
| `WorkflowBuilder` | Orchestrates the 3-tab create-project interface; holds `createResult` state |
| `WorkflowSetupTab` | Create Project form: repo name, visibility, service settings, catalog selectors, test toggles |
| `SetupResultPanel` | Sidebar on Setup tab showing the latest created project with repo/actions/commit links |
| `WorkflowCurrentTab` | Current tab: success banner for latest result, provisioned projects list, YAML history |
| `WorkflowAllTab` | Catalog tab: template grid with "Use in Create Project" |
| `WorkflowStudioTabs` | Accessible tab bar with keyboard navigation (arrow keys, Home, End) |
| `FlowBackground` | Animated background (particles, ribbons, blobs) used on all pages |

### Built hooks

| Hook | Description |
|------|-------------|
| `useAuthSession` | Session fetch + loading/signed-in/signed-out/error states |
| `useCreateProjectForm` | Form state for `POST /api/v1/projects`; slug-normalises repo/service names; validates before submit |
| `useGithubInstallations` | Fetches install URL, links installations, detects all-repos access; auto-captures `?installation_id=` from callback URL |
| `useProjectOptionsCatalog` | Loads repo shapes, project types, workflow recipes; cascading selection logic |
| `useProvisionedProjects` | Fetches `GET /api/v1/projects`; supports prepending a fresh create result |
| `useWorkflowCatalog` | Fetches templates + categories; local filtering |
| `useWorkflowHistory` | Fetches `GET /api/v1/workflows/history` |

### Built API client (`src/lib/api/`)

| Module | Endpoints |
|--------|-----------|
| `auth.ts` | `GET /auth/github/start`, `GET /auth/google/start`, `GET /auth/me`, `POST /auth/logout` |
| `catalog.ts` | `GET /catalog/categories`, `GET /catalog/templates`, `GET /catalog/project-options` |
| `github.ts` | `GET /github/app/install-url`, `POST /github/installations`, `GET /github/installations/repos`, `GET /github/installations/accounts` |
| `projects.ts` | `POST /api/v1/projects` (primary flow), `POST /api/v1/projects/setup` (existing repo), `GET /api/v1/projects` |
| `subscription.ts` | `POST /subscription/monthly/activate`, `POST /subscription/monthly/cancel` |
| `workflows.ts` | `POST /workflows/generate`, `GET /workflows/history` |

### Not yet built

| Route | Description |
|-------|-------------|
| `/runs` | Workflow run history per repo — blocked on GitHub App webhook receiver in BE |

---

## Planned surfaces (future, post-MVP)

- PayMongo real checkout: `/billing` → `POST /v1/checkout/sessions` → redirect to PayMongo URL
- Runs page: polls BE for `workflow_run` events mirrored from GitHub App webhooks

---

## Next.js config (`next.config.ts`)

The config object is currently empty — no custom image domains, experimental flags, rewrites, redirects, or environment variable exposure have been added yet.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  /* config options here */
};
```

---

## TypeScript config (`tsconfig.json`)

| Setting | Value |
|---------|-------|
| `target` | `ES2017` |
| `strict` | `true` |
| `allowJs` | `false` |
| `moduleResolution` | `bundler` |
| `jsx` | `react-jsx` |
| `noEmit` | `true` |
| `isolatedModules` | `true` |
| `incremental` | `true` |
| Path alias | `@/*` → `./src/*` |

The `next` plugin is registered under `compilerOptions.plugins`. No additional path aliases beyond `@/*`.

---

## Tailwind 4 + PostCSS (`postcss.config.mjs`, `src/app/globals.css`)

Tailwind v4 does **not** use a `tailwind.config.js` file. Configuration is done entirely in CSS.

**`postcss.config.mjs`** — single plugin:
```js
plugins: { "@tailwindcss/postcss": {} }
```

**`src/app/globals.css`** — Tailwind v4 entry point:
- `@import "tailwindcss"` (v4 style — replaces the three `@tailwind` directives from v3)
- `@theme inline` block defines design tokens as CSS variables: `--color-background`, `--color-foreground`, `--font-sans` (Geist Sans), `--font-mono` (Geist Mono)
- CSS custom properties `--background` and `--foreground` are set at `:root` with a `prefers-color-scheme: dark` override

---

## Test configuration

### `jest.config.js`

| Setting | Value |
|---------|-------|
| Test environment | `jest-environment-jsdom` |
| Test roots | `<rootDir>/tests`, `<rootDir>/src` |
| Setup file | `<rootDir>/jest.setup.js` (runs after framework is installed) |
| Ignored paths | `/node_modules/`, `/.next/` |
| Coverage collected from | `src/**/*.{ts,tsx}` excluding `.d.ts` files and all `src/app/**` files |
| Coverage reporters | `text`, `lcov`, `json-summary` |
| Coverage thresholds | branches ≥ 80%, functions ≥ 80%, lines ≥ 85%, statements ≥ 85% |

Config is created via `nextJest({ dir: './' })` which wires up Next.js transforms automatically.

### `jest.setup.js`

```js
require('@testing-library/jest-dom');
```

This globally imports all `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`, `toHaveTextContent`) for every test file.

---

## Existing test files

### `tests/unit/sanity.test.ts`

A trivial smoke test — `expect(true).toBe(true)` — used to verify the Jest pipeline is wired correctly. No imports, no subject under test.

### `tests/unit/sum.test.ts`

Tests `src/lib/sum.ts`. Three cases: positive numbers, negative numbers, mixed signs. This is the only non-trivial unit test that currently exists.

### `tests/performance/k6-smoke.ts`

A generic, reusable k6 smoke script. **Must be run with the k6 CLI, not Jest.** It is not picked up by `npm test`.

Key behaviour:
- Reads configuration entirely from environment variables — no hardcoded targets
- `BASE_URL` (default `http://localhost:3000`), `SMOKE_PATHS` (comma-separated list of paths, default `/`), `SYSTEM_NAME` (default `generic-web`)
- `MAX_DURATION_MS` (default `1000`) — per-request latency assertion
- `EXPECTED_STATUSES` / `EXPECTED_STATUS` — allowed HTTP status codes; if `BASE_URL` matches `*.vercel.app` and no custom statuses are provided, automatically allows `200|401|403` (Vercel protected preview branches)
- `EXPECTED_TEXT` — optional substring check on response body
- k6 scenario: `constant-vus` executor; VU count from `K6_VUS` (default `1`), duration from `K6_DURATION` (default `30s`)
- Thresholds: `http_req_failed < 1%`, `http_req_duration p(95) < 800ms`, `checks rate > 99%`

### `tests/e2e/playwright-e2e.ts`

A self-contained Playwright smoke script run via `npm run test:e2e` (`tsx tests/e2e/playwright-e2e.ts`). **Not a Playwright Test (`*.spec.ts`) file — it is a plain Node script.**

Key behaviour:
- Browser selected by `E2E_BROWSER` env var (default `chromium`; also accepts `firefox`, `webkit`); all browsers run headless
- If `E2E_BASE_URL` is not set, spawns `npm run dev` on `127.0.0.1:PORT` (default port `4173`) and kills it on exit
- If `E2E_BASE_URL` is set, connects to that external URL (timeout extended to 120 s)
- Waits up to 45 s (or 120 s for external targets) for the server to respond
- Navigates to the root URL; asserts the page body contains one of the known landing-page markers: `"Get started by editing"` or `"To get started, edit the page.tsx file."`
- If the external target returns `401`/`403` or contains Vercel/auth-wall text, the test passes silently (protected preview branch)
- Exits with code `1` on any unexpected failure

---

## Docker setup

### `Dockerfile` — three-stage build

| Stage | Base image | Purpose |
|-------|-----------|---------|
| `base` | `node:24-alpine` | Shared base; runs `apk upgrade --no-cache` to patch OS packages |
| `deps` | `base` | Copies `package*.json` and runs `npm ci` to install all dependencies |
| `builder` | `base` | Copies `node_modules` from `deps`, copies the full source, runs `npm run build` |
| `runner` | `base` | Production image; runs `npm ci --omit=dev`, removes npm/npx from the image, copies `.next/`, `public/`, and `next.config.ts` from `builder` |

Exposed port: **3000**. Start command: `node node_modules/next/dist/bin/next start -p 3000`.

### `.dockerignore`

The following are excluded from the Docker build context:

```
node_modules
.next
coverage
.git
.github
npm-debug.log*
```

---

## Data flow rules

- **Never store provider tokens in the browser.** GitHub access token and Render/Vercel credentials live only in the BE session and Supabase.
- All GitHub API calls are proxied through the BE. FE only talks to `NEXT_PUBLIC_API_URL` (the BE base URL).
- The Create Project UI must be catalog-driven: read valid repo shapes, project
  types, workflow recipes, defaults, and options from the backend instead of
  hardcoding language/workflow combinations.
- Use `credentials: "include"` on every `fetch` so the session cookie is sent cross-origin.
- BE origin must be in `CORS_ORIGINS` env var on the BE side; session cookie name is `cicd_workflow_sid`.

---

## Conventions

- TypeScript strict mode — `"strict": true` in `tsconfig.json`; `allowJs: false`.
- **Server components by default.** Use `"use client"` only for forms, interactive pickers, and components that need browser APIs.
- No direct Supabase client in FE — all data goes through the BE API.
- Tailwind 4 utility classes (no `tailwind.config.js`; configured via `@theme` in CSS).
- No hardcoded API URLs — read from `process.env.NEXT_PUBLIC_API_URL`.
- Path alias `@/` maps to `src/` — use it for all cross-directory imports.

---

## ESLint config (`eslint.config.mjs`)

Uses the flat config format (ESLint 9+). Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Ignores `.next/`, `out/`, `build/`, and `next-env.d.ts`. The `@typescript-eslint/no-require-imports` rule is disabled for `jest.config.js` and `jest.setup.js` because those files intentionally use CommonJS `require()`.

---

## Environment variables

```
NEXT_PUBLIC_API_URL=http://localhost:4000    # BE base URL; must match FRONTEND_URL in BE
```

---

## Testing

```bash
npm test                # Jest + jsdom; unit tests under tests/unit/ and src/
npm run test:watch      # Jest in watch mode
npm run test:e2e        # Playwright smoke via tsx tests/e2e/playwright-e2e.ts
# k6 smoke (requires k6 CLI installed separately):
# k6 run tests/performance/k6-smoke.ts -e BASE_URL=http://localhost:3000
```

Coverage target: branches ≥ 80%, functions ≥ 80%, lines ≥ 85%, statements ≥ 85%.

Note: `src/app/**` files are excluded from coverage collection (see `jest.config.js`). Only files under `src/lib/` and future non-app source directories count toward coverage thresholds.

---

## Build and run

```bash
npm install
npm run dev             # Next.js dev server on port 3000
npm run build           # Production build
npm start               # Serve production build on port 3000
npm run lint            # ESLint (flat config, ESLint 9)
```

Lockfile is `package-lock.json` — use `npm` (not yarn/pnpm). Port 3000 must match `FRONTEND_URL` in the BE `.env`.

### Key dependency versions

| Package | Version |
|---------|---------|
| `next` | 16.2.1 |
| `react` / `react-dom` | 19.2.4 |
| `tailwindcss` | ^4.2.2 |
| `@tailwindcss/postcss` | ^4.2.2 |
| `jest` / `jest-environment-jsdom` | ^30.3.0 |
| `@testing-library/jest-dom` | ^6.9.1 |
| `playwright` | ^1.58.2 |
| `typescript` | ^6.0.2 |
| `tsx` | ^4.21.0 (runs the e2e script) |
