# CI/CD Workflow Studio Frontend

Next.js frontend for the product experience:

1. User signs in with GitHub.
2. User activates a subscription.
3. User opens Create Project and chooses repo shape, project type, workflow recipe, and options from the shared catalog.
4. User creates a GitHub project with starter files, `CI_TOKEN`, and a customized CI/CD workflow.

## Local Run

1. Install packages:

```bash
npm install
```

2. Set environment variable for backend API (optional if using default):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

3. Start development server:

```bash
npm run dev
```

## Local MVP Smoke Notes

Run the frontend at `http://localhost:3000` and the backend at
`http://localhost:4000`. The default API base URL is already
`http://localhost:4000/api/v1`; set `NEXT_PUBLIC_API_BASE_URL` only when using a
different backend URL.

Before opening `/workflows`, finish the backend GitHub setup:

- GitHub OAuth App is configured for
  `http://localhost:4000/api/v1/auth/github/callback`.
- GitHub App is installed with all repositories access.
- Backend `.env` has `CI_VALIDATE_URL=https://<trycloudflare-host>/v1/ci/validate`.
- `Tone-Lloyd-Sir-Catubag-CICD/central-workflow` is public for the smoke and has
  a `v1` ref.

Smoke path:

1. Sign in with GitHub.
2. Activate mock Pro at `/subscribe`.
3. Open `/workflows`.
4. Install/link the GitHub App installation ID.
5. Create `flowci-mvp-nextjs-YYYYMMDD-HHMM` as a private Next.js project.
6. Repeat with `flowci-mvp-nestjs-YYYYMMDD-HHMM`.
7. Open the created repo Actions tab and confirm `validate-access` reaches the
   backend callback.

## Quality Commands

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Product Integration

- Frontend connects to `cicd-workflow-be` API using cookie-based session auth.
- Backend reads catalog, starter templates, and workflow templates from sibling repo `../workflow-core`.
- The Create Project UI should be catalog-driven through `repoShape -> projectTypeId -> workflowRecipeId -> options`, not hardcoded per language.
- Generated output is shown in UI and can be copied or downloaded as `.yml`.
