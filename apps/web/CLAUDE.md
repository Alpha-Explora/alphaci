# CLAUDE.md — cicd-workflow-fe

Next.js 16 (app router, React 19, Tailwind 4) frontend for the CI/CD-as-a-Service SaaS. See the workspace root [`../CLAUDE.md`](../CLAUDE.md) for product context and cross-repo flow, and [`../cicd-workflow-be/CLAUDE.md`](../cicd-workflow-be/CLAUDE.md) for API details.

---

## Current state

Only the default Next.js scaffold exists. **No auth UI, no API client, no real product surfaces have been built yet.** Tooling is fully wired: Tailwind 4, Jest (jsdom), Playwright, k6 smoke test.

### Actual src/ tree (exists today)

```
src/
  app/
    App.css          # .app-root flex-column wrapper; references --background/--foreground CSS vars
    App.tsx          # Thin wrapper component — renders children inside .app-root div
    globals.css      # Tailwind v4 entry (@import "tailwindcss"), CSS vars, @theme inline block, dark-mode media query
    layout.tsx       # Root layout; loads Geist Sans + Geist Mono via next/font/google; sets <html lang="en">
    page.tsx         # Default Next.js landing page (scaffold); title text: "To get started, edit the page.tsx file."
  lib/
    sum.ts           # Pure utility: export function sum(left, right): number — exists only for test scaffolding
```

Everything else listed under "Planned surfaces" below does **not** exist yet.

---

## Planned surfaces (not yet built)

| Route | Description |
|-------|-------------|
| `/login` | "Sign in with GitHub" button → redirects to `BE /api/v1/auth/github/start?returnTo=/dashboard`. After callback, session cookie is set. |
| `/billing` | Plan comparison card (Free / Pro ₱300 / Enterprise ₱1200). "Subscribe" → `BE POST /v1/checkout/sessions` → redirect to PayMongo checkout URL. |
| `/connect` | "Install GitHub App" button (links to GitHub App installation URL). MVP requires an all-repositories installation so newly created repos are accessible to the App. |
| `/projects/new` | Create Project flow: repo name, visibility, repo shape, project type, workflow recipe, and recipe-filtered options. Submit to `BE POST /api/v1/projects`. MVP enables only `repoShape=single-app`; monorepo/fullstack/library/mobile should be shown later only when backend support exists. |
| `/setup/[owner]/[repo]` | Existing-repo setup path using `BE POST /api/v1/projects/setup`; not the primary MVP Create Project flow. |
| `/runs` | Workflow run history for the user's connected repos. Polled from BE (which mirrors GitHub App `workflow_run` webhook events). |
| `/dashboard` | Post-login landing: current projects, subscription status, primary Create Project CTA, and quick links to setup/runs. |

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
