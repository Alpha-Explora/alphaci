---
type: "Playbook"
title: "Local frontend verification"
description: "Reproducible local checks for code, architecture, documentation, and the versioned capability package."
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
- Provide `NEXT_PUBLIC_API_BASE_URL` when a running app or authenticated check needs the backend. `NEXT_PUBLIC_API_URL` remains a legacy alias.
- Do not store provider tokens in the browser or in frontend environment files.

## Fast documentation loop

```bash
npm run generate:architecture-maps
npm run check:capability-package
npm run check:okf
npm run check:capabilities
npm run check:documentation
```

`generate:architecture-maps` rewrites the `*.generated.md` maps and the three `pack.md` files. `check:documentation` runs the same generator with `--check` and fails on drift.

The frontend profile and documentation checks consume `vendor/@alphaci/capability-catalog`. Update that fixture as a reviewed package change, then regenerate the maps; do not use a sibling checkout as the contract.

## Full local loop

```bash
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

CI (`.github/workflows/boundaries.yml`) also runs `npm run check:profiles` and builds both profiles with `node scripts/build-profile.cjs --profile hosted` and `--profile enterprise`. Each profile build runs the exclusion check on its output.

## Test baseline

There is no accepted failure baseline. `npm test` runs the whole suite with coverage and fails below the coverage floor in `jest.config.js`. Compare a failing run with the same command on `main` before attributing a failure to a change.

## Evidence

Record the commands run, pass/fail result, intentionally skipped authenticated checks, and any backend environment required. A static pass does not prove a live session cookie, CORS, or provider API behavior.
