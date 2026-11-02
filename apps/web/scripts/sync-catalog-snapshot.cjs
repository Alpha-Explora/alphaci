'use strict';

// Documentation helper. Active checks and builds consume the
// @alphaci/capability-catalog workspace package; this script copies its
// records into the documentation snapshot, which carries the same fields.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'capabilities/catalog.snapshot.json');
const VENDOR_PACKAGE = path.dirname(require.resolve('@alphaci/capability-catalog'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeSnapshot(capabilities) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify(capabilities, null, 2) + '\n', 'utf8');
}

function main() {
  const capabilities = readJson(path.join(VENDOR_PACKAGE, 'catalog.json'));
  writeSnapshot(capabilities);
  console.log('Wrote ' + capabilities.length + ' capabilities to capabilities/catalog.snapshot.json');
}

if (require.main === module) main();

module.exports = {
  SNAPSHOT,
  VENDOR_PACKAGE,
  writeSnapshot,
};
