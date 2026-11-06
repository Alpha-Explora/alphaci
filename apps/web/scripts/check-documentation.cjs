#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRECTORIES = new Set(['node_modules']);

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

function sourceBranchErrors() {
  const errors = [];
  const src = path.join(ROOT, 'src');
  // Clients differ by data (capability flags and options, ADR-0023), never by
  // an if on the client id, exactly as editions do.
  const patterns = [
    /\bedition\s*(===|!==)/,
    /\bclient(?:Id)?\s*(===|!==)\s*['"`]/,
    /['"`][^'"`\n]*['"`]\s*(===|!==)\s*[\w.?]*\bclient(?:Id)?\b/,
  ];
  for (const file of filesUnder(src).filter((item) => /\.(ts|tsx)$/.test(item))) {
    const text = fs.readFileSync(file, 'utf8');
    if (patterns.some((pattern) => pattern.test(text))) {
      errors.push(`${relative(file)}: edition and client branches are not allowed; use capability flags`);
    }
  }
  return errors;
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

function main() {
  const errors = [
    ...sourceBranchErrors(),
    ...capabilityRegistryErrors(),
  ];

  if (errors.length > 0) {
    console.error(`Documentation check failed: ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`  ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('Web documentation checks passed: edition and client branches and capability sources. The bundle and the maps generated into it are checked by npm run check:documentation at the repository root.');
}

if (require.main === module) main();

module.exports = { sourceBranchErrors };
