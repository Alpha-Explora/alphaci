#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateBundle } = require('./check-okf-bundle.cjs');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const REQUIRED_FILES = [
  'docs/index.md',
  'docs/log.md',
  'docs/constitution.md',
  'docs/executive/index.md',
  'docs/executive/golden-copy-executive-report.md',
  'docs/architecture/index.md',
  'docs/architecture/current-architecture.md',
  'docs/architecture/feature-map.generated.md',
  'docs/architecture/route-map.generated.md',
  'docs/architecture/architecture-checks.generated.md',
  'docs/architecture/decisions/index.md',
  'docs/architecture/decisions/adr-0001-feature-sliced-mvvm.md',
  'docs/architecture/decisions/adr-0002-capability-consumption.md',
  'docs/architecture/decisions/adr-0003-shared-catalog-and-packs.md',
  'docs/capabilities/index.md',
  'docs/capabilities/capability-contract.md',
  'docs/capabilities/capability-matrix.generated.md',
  'docs/capabilities/catalog.snapshot.json',
  'docs/capabilities/surface-registry.ts',
  'docs/packs/index.md',
  'docs/packs/pack-contract.md',
  'docs/packs/pack-template.md',
  'docs/packs/saas/index.md',
  'docs/packs/saas/pack.md',
  'docs/packs/edu/index.md',
  'docs/packs/edu/pack.md',
  'docs/packs/enterprise/index.md',
  'docs/packs/enterprise/pack.md',
  'docs/runbooks/index.md',
  'docs/runbooks/runbook-local-verification.md',
  'docs/runbooks/runbook-session-auth.md',
  'CHANGELOG.md',
];

const CANONICAL_NAME = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9-]+)*)\.md$/;
const RESERVED_NAMES = new Set(['index.md', 'log.md']);
const SKIP_DIRECTORIES = new Set(['superpowers', 'node_modules']);
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
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function namingErrors() {
  const errors = [];
  for (const file of filesUnder(DOCS)) {
    const rel = relative(file);
    if (path.extname(file).toLowerCase() !== '.md') continue;
    const name = path.basename(file);
    if (RESERVED_NAMES.has(name)) continue;
    if (!CANONICAL_NAME.test(name)) {
      errors.push(`${rel}: canonical documentation filenames must be lower-kebab-case`);
    }
  }
  return errors;
}

function requiredFileErrors() {
  return REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(ROOT, file))).map(
    (file) => `${file}: required documentation file is missing`,
  );
}

function staleClaimErrors() {
  const errors = [];
  const files = [
    ...filesUnder(DOCS).filter((file) => file.endsWith('.md')),
    path.join(ROOT, 'README.md'),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const rel = relative(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of PROHIBITED_DOCUMENTATION_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`${rel}: contains plan- or conversation-specific text matching ${pattern}`);
      }
    }
  }
  return errors;
}

function sourceBranchErrors() {
  const errors = [];
  const src = path.join(ROOT, 'src');
  for (const file of filesUnder(src).filter((item) => /\.(ts|tsx)$/.test(item))) {
    const text = fs.readFileSync(file, 'utf8');
    if (/\bedition\s*(===|!==)/.test(text)) {
      errors.push(`${relative(file)}: edition branches are not allowed; use capability flags`);
    }
  }
  return errors;
}

function changelogErrors() {
  const file = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(file)) return ['CHANGELOG.md: repository changelog is required'];
  const text = fs.readFileSync(file, 'utf8');
  return /^##\s+\[Unreleased\]\s*$/m.test(text)
    ? []
    : ['CHANGELOG.md: an ## [Unreleased] section is required'];
}

function generatedMapErrors() {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'generate-architecture-maps.mjs'), '--check'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status === 0) return [];
  return [
    `generated maps are stale or cannot be regenerated: ${(result.stderr || result.stdout).trim()}`,
  ];
}

function capabilityRegistryErrors() {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'check-capabilities.cjs')],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status === 0) return [];
  return [
    `capability surface check failed: ${(result.stderr || result.stdout).trim()}`,
  ];
}

function generatedSurfaceRegistryErrors() {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'generate-capability-surface-registry.cjs'), '--check'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status === 0) return [];
  return [
    'generated capability surface registry is stale or cannot be regenerated: ' +
      (result.stderr || result.stdout).trim(),
  ];
}

function main() {
  const errors = [
    ...requiredFileErrors(),
    ...namingErrors(),
    ...staleClaimErrors(),
    ...sourceBranchErrors(),
    ...changelogErrors(),
    ...generatedMapErrors(),
    ...generatedSurfaceRegistryErrors(),
    ...capabilityRegistryErrors(),
    ...validateBundle(DOCS),
  ];

  if (errors.length > 0) {
    console.error(`Documentation check failed: ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`  ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('Documentation checks passed: OKF v0.2, naming, policy, and generated maps.');
}

if (require.main === module) main();

module.exports = {
  CANONICAL_NAME,
  namingErrors,
  requiredFileErrors,
  staleClaimErrors,
  sourceBranchErrors,
};
