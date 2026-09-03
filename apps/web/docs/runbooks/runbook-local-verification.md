---
type: "Playbook"
title: "Local frontend verification"
description: "Reproducible local checks for code, architecture, documentation, and the shared catalog snapshot."
tags: [runbook, verification, development]
status: stable
sources:
  - id: package-scripts
    resource: "package.json"
    title: "Repository verification scripts"
  - id: ci-workflow
    resource: ".github/workflows/boundaries.yml"
    title: "Continuous integration workflow"
---
# Local frontend verification

Use this sequence before merging a change that affects source, styles, capability surfaces, or documentation.

## Preconditions

- Use Node.js 24 as configured by CI.
- Install the exact lockfile with `npm ci`.
- Provide `NEXT_PUBLIC_API_BASE_URL` when a running app or authenticated check needs the backend origin. `NEXT_PUBLIC_API_URL` remains a legacy alias.
- Do not store provider tokens in the browser or in frontend environment files.

## Fast documentation loop

```bash
npm run generate:architecture-maps
npm run check:okf
npm run check:capabilities
npm run check:documentation
```

When the sibling backend checkout is present, the generate step refreshes `docs/capabilities/catalog.snapshot.json` from that registry.

## Full local loop

```bash
npm run typecheck
npx eslint src --max-warnings=0
npm run lint:css
npm run boundaries
npm run arch:check
npm test
npm run build
npm run check:documentation
```

## Known baseline

Ten tests in `tests/unit/project-env-panel.test.tsx` fail on `main` from a jsdom `element.tagName` null in the suite helper. If a change leaves exactly those ten failing, it has not broken the product suite.

## Evidence

Record the commands run, pass/fail result, intentionally skipped authenticated checks, and any backend environment required. A static pass does not prove a live session cookie, CORS, or provider API behavior.
