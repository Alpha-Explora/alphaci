#!/usr/bin/env node
'use strict';

// Checks the repository's one documentation bundle, docs/, including drift in
// the maps and pack profiles each app generates into it. CI runs this on every
// event, because a docs-only change affects neither app. Each app's own
// check:documentation covers files inside that app.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateBundle } = require('./check-okf-bundle.cjs');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
// Dated plans and designs that are not built yet; not current-state concepts.
const SKIP_DIRECTORIES = new Set(['plans', 'specs', 'node_modules']);
const WORKSPACE_PARENTS = ['apps', 'packages'];

const REQUIRED_FILES = [
  'docs/index.md',
  'docs/log.md',
  'docs/constitution.md',
  'docs/executive/golden-copy-executive-report.md',
  'docs/architecture/index.md',
  'docs/architecture/api/current-architecture.md',
  'docs/architecture/api/context-contracts.md',
  'docs/architecture/api/context-map.generated.md',
  'docs/architecture/api/events-map.generated.md',
  'docs/architecture/api/provider-map.generated.md',
  'docs/architecture/api/route-map.generated.md',
  'docs/architecture/api/schema-ownership.generated.md',
  'docs/architecture/api/architecture-checks.generated.md',
  'docs/architecture/web/current-architecture.md',
  'docs/architecture/web/feature-map.generated.md',
  'docs/architecture/web/route-map.generated.md',
  'docs/architecture/web/architecture-checks.generated.md',
  'docs/architecture/decisions/index.md',
  'docs/capabilities/capability-contract.md',
  'docs/capabilities/capability-matrix.generated.md',
  'docs/capabilities/surface-matrix.generated.md',
  'docs/capabilities/capability-ledger.generated.md',
  'docs/packs/pack-contract.md',
  'docs/packs/pack-template.md',
  'docs/packs/saas/pack.md',
  'docs/packs/edu/pack.md',
  'docs/packs/enterprise/pack.md',
  'docs/runbooks/index.md',
  'docs/runbooks/runbook-local-verification.md',
];

const CANONICAL_NAME = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9-]+)*)\.md$/;
const RESERVED_NAMES = new Set(['index.md', 'log.md']);
const PROHIBITED_DOCUMENTATION_PATTERNS = [
  /conversation/i,
  /\bchat\b/i,
  /worktree/i,
  /remediation trunk/i,
  /old plan/i,
  /as discussed/i,
  /we decided/i,
  /future state/i,
  /future topology/i,
  /future tree/i,
  /microservice/i,
  /extract later/i,
  /module consolidation plan/i,
  /FUTURE_STATE/i,
  /MODULE_CONSOLIDATION_PLAN/i,
];

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      files.push(...filesUnder(full));
      continue;
    }
    files.push(full);
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function requiredFileErrors() {
  return REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(ROOT, file))).map(
    (file) => `${file}: required documentation file is missing`,
  );
}

function namingErrors() {
  return filesUnder(DOCS)
    .filter((file) => path.extname(file).toLowerCase() === '.md')
    .filter((file) => !RESERVED_NAMES.has(path.basename(file)))
    .filter((file) => !CANONICAL_NAME.test(path.basename(file)))
    .map((file) => `${relative(file)}: canonical documentation filenames must be lower-kebab-case`);
}

function staleClaimErrors() {
  const files = [
    ...filesUnder(DOCS).filter((file) => file.endsWith('.md')),
    path.join(ROOT, 'README.md'),
    ...WORKSPACE_PARENTS.flatMap((parent) =>
      workspaces(parent).map((workspace) => path.join(workspace, 'README.md')),
    ),
  ];
  const errors = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of PROHIBITED_DOCUMENTATION_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`${relative(file)}: contains plan- or conversation-specific text matching ${pattern}`);
      }
    }
  }
  return errors;
}

function workspaces(parent) {
  const directory = path.join(ROOT, parent);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name));
}

function scatteredBundleErrors() {
  return WORKSPACE_PARENTS.flatMap(workspaces)
    .filter((workspace) => fs.existsSync(path.join(workspace, 'docs')))
    .map(
      (workspace) =>
        `${relative(workspace)}/docs: documentation lives only in the root docs/ bundle; move these files there (app-specific concepts go under docs/architecture/<app>/)`,
    );
}

// Every `npm run <script>` a doc names must exist in some workspace manifest,
// so a renamed or removed script cannot leave instructions that fail.
function unknownScriptErrors() {
  const manifests = [ROOT, ...WORKSPACE_PARENTS.flatMap(workspaces)]
    .map((directory) => path.join(directory, 'package.json'))
    .filter((file) => fs.existsSync(file));
  const scripts = new Set(
    manifests.flatMap((file) => Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).scripts ?? {})),
  );
  const files = [
    ...filesUnder(DOCS).filter((file) => file.endsWith('.md') && path.basename(file) !== 'log.md'),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'AGENTS.md'),
    ...WORKSPACE_PARENTS.flatMap(workspaces).flatMap((workspace) => [
      path.join(workspace, 'README.md'),
      path.join(workspace, 'CLAUDE.md'),
    ]),
  ].filter((file) => fs.existsSync(file));
  const errors = [];
  for (const file of files) {
    const named = new Set(
      [...fs.readFileSync(file, 'utf8').matchAll(/npm run ([a-z0-9:_-]+)/gi)].map((match) => match[1]),
    );
    for (const script of named) {
      if (!scripts.has(script)) {
        errors.push(`${relative(file)}: names \`npm run ${script}\`, which no package.json defines`);
      }
    }
  }
  return errors;
}

function generatedMapErrors() {
  return ['api', 'web'].flatMap((app) => {
    const cwd = path.join(ROOT, 'apps', app);
    const result = spawnSync(
      process.execPath,
      [path.join(cwd, 'scripts', 'generate-architecture-maps.mjs'), '--check'],
      { cwd, encoding: 'utf8' },
    );
    if (result.status === 0) return [];
    return [
      `apps/${app} generated docs are stale; run npm run generate:architecture-maps -w @alphaci/${app}: ${(result.stderr || result.stdout).trim()}`,
    ];
  });
}

function main() {
  const errors = [
    ...scatteredBundleErrors(),
    ...requiredFileErrors(),
    ...namingErrors(),
    ...staleClaimErrors(),
    ...validateBundle(DOCS),
    ...unknownScriptErrors(),
    ...generatedMapErrors(),
  ];
  if (errors.length > 0) {
    console.error(`Documentation check failed: ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`  ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('Documentation checks passed: one bundle, OKF v0.2, naming, current-state policy, and generated maps.');
}

if (require.main === module) main();

module.exports = { scatteredBundleErrors, namingErrors, staleClaimErrors, requiredFileErrors, unknownScriptErrors };
