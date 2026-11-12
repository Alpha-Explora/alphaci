#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(full));
    else files.push(full);
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function sourceBranchErrors() {
  const errors = [];
  // Comparing an edition to a literal is a product branch. Comparing two
  // edition values to each other is validation, such as rejecting a client
  // policy written for a different edition, and stays allowed.
  const patterns = [
    /\bedition\s*(===|!==)\s*['"`]/,
    /['"`](saas|edu|enterprise)['"`]\s*(===|!==)/,
    // Clients differ by data (their policy and their deployment's capability
    // options, ADR-0024), never by an if on the client id. Comparing two
    // client ids, such as a document against ALPHACI_CLIENT, stays allowed.
    /\bclient(?:Id)?\s*(===|!==)\s*['"`]/,
    /['"`][^'"`\n]*['"`]\s*(===|!==)\s*[\w.?]*\bclient(?:Id)?\b/,
    /\bALPHACI_CLIENT['"`]?\]?\s*(===|!==)\s*['"`]/,
  ];
  for (const file of filesUnder(path.join(ROOT, 'src')).filter((item) => item.endsWith('.ts'))) {
    const text = fs.readFileSync(file, 'utf8');
    if (patterns.some((pattern) => pattern.test(text))) {
      errors.push(`${relative(file)}: edition and client branches are not allowed; use composition data`);
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
    `capability registry check failed: ${(result.stderr || result.stdout).trim()}`,
  ];
}

function capabilityLedgerErrors() {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'check-capability-ledger.cjs')],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status === 0) return [];
  return [
    `capability ledger check failed: ${(result.stderr || result.stdout).trim()}`,
  ];
}

function compositionSourceErrors() {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'generate-composition-source.mjs'), '--check'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status === 0) return [];
  return [
    `composition source check failed: ${(result.stderr || result.stdout).trim()}`,
  ];
}

function main() {
  const errors = [
    ...sourceBranchErrors(),
    ...capabilityRegistryErrors(),
    ...capabilityLedgerErrors(),
    ...compositionSourceErrors(),
  ];

  if (errors.length > 0) {
    console.error(`Documentation check failed: ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`  ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('API documentation checks passed: edition and client branches and capability sources. The bundle and the maps generated into it are checked by npm run check:documentation at the repository root.');
}

if (require.main === module) main();

module.exports = { sourceBranchErrors };
