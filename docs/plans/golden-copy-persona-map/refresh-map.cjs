'use strict';

// Investigation artifact only. No application or catalog files are written.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const sourcePath = path.join(root, 'apps/api/src/kernel/composition/catalog.source.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const validator = require(path.join(root, 'apps/api/scripts/lib/composition-source.cjs'));
const errors = validator.validateSource(source);
if (errors.length) throw new Error(errors.join('\n'));
const editions = validator.EDITIONS;
const counts = Object.fromEntries(editions.map(edition => {
  const rows = source.capabilities.filter(row => row.editions.includes(edition));
  return [edition, Object.fromEntries(['stable', 'limited', 'not-implemented'].map(status =>
    [status, rows.filter(row => row.maturity === status).length]))];
}));
const snapshot = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  source: 'apps/api/src/kernel/composition/catalog.source.json',
  sha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
  counts,
  capabilities: source.capabilities,
  features: source.features ?? [],
};
const output = path.join(__dirname, 'feature-map.html');
const html = fs.readFileSync(output, 'utf8').replace(
  /(<script id="catalog-data" type="application\/json">)[\s\S]*?(<\/script>)/,
  (_, before, after) => before + JSON.stringify(snapshot).replace(/</g, '\\u003c') + after,
);
if (!html.includes(snapshot.sha256)) throw new Error('Catalog data marker missing');
fs.writeFileSync(output, html);
console.log(JSON.stringify({ artifact: path.relative(root, output), capabilities: source.capabilities.length, counts }));
