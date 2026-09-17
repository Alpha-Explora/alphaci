'use strict';

// Documentation helper. Active checks and builds consume the versioned local
// @alphaci/capability-catalog fixture; this script refreshes the richer
// documentation snapshot without consulting a sibling checkout.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'docs/capabilities/catalog.snapshot.json');
const VENDOR_PACKAGE = path.join(ROOT, 'vendor', '@alphaci', 'capability-catalog');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeSnapshot(capabilities) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify(capabilities, null, 2) + '\n', 'utf8');
}

function main() {
  const existing = readJson(SNAPSHOT);
  const detailsByKey = new Map(existing.map((record) => [record.key, record]));
  const catalog = readJson(path.join(VENDOR_PACKAGE, 'catalog.json'));
  const capabilities = catalog.map((record) => {
    const details = detailsByKey.get(record.key);
    if (!details) {
      throw new Error('Snapshot is missing documentation details for ' + record.key);
    }
    return {
      ...details,
      key: record.key,
      maturity: record.maturity,
      editions: record.editions,
      requires: record.requires,
      surface: record.surface,
    };
  });
  writeSnapshot(capabilities);
  console.log('Wrote ' + capabilities.length + ' capabilities to docs/capabilities/catalog.snapshot.json');
}

if (require.main === module) main();

module.exports = {
  SNAPSHOT,
  VENDOR_PACKAGE,
  writeSnapshot,
};
