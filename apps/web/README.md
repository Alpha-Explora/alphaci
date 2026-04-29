# CI/CD Workflow Studio Frontend

Next.js frontend for the product experience:

1. User signs in with GitHub.
2. User activates a subscription.
3. User browses workflow categories and templates from the shared catalog.
4. User generates a customized CI/CD workflow file.

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

## Quality Commands

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Product Integration

- Frontend connects to `cicd-workflow-be` API using cookie-based session auth.
- Backend reads templates from sibling repo `../workflow-core/workflow-templates`.
- Generated output is shown in UI and can be copied or downloaded as `.yml`.
