#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  loadCatalogPackage,
  packageDriftErrors,
} = require('./lib/capability-profile.cjs');

const ROOT = path.resolve(__dirname, '..');
const snapshot = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/capabilities/catalog.snapshot.json'), 'utf8'),
);
let errors;
try {
  errors = packageDriftErrors(snapshot, loadCatalogPackage());
} catch (error) {
  errors = [`@alphaci/capability-catalog: ${error.message}`];
}
if (errors.length > 0) {
  console.error(`Capability package drift check failed: ${errors.length} error(s).`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exitCode = 1;
} else {
  console.log('Capability package drift check passed: provenance, canonical artifact, and catalog match.');
}
