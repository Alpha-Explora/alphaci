'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'docs/capabilities/catalog.snapshot.json');

function siblingRegistryPath() {
  if (process.env.ALPHACI_BE_ROOT) {
    return path.join(process.env.ALPHACI_BE_ROOT, 'docs/capabilities/registry.ts');
  }
  return path.resolve(ROOT, '..', 'alphaci-enterprise-be', 'docs/capabilities/registry.ts');
}

function readRegistry(file) {
  const source = fs.readFileSync(file, 'utf8');
  const match = /export const CAPABILITIES = (\[[\s\S]*?\])\s+as const;\s*$/m.exec(source);
  if (!match) {
    throw new Error(`${file} must export a JSON-shaped CAPABILITIES array`);
  }
  return JSON.parse(match[1]);
}

function writeSnapshot(capabilities) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify(capabilities, null, 2)}\n`, 'utf8');
}

function main() {
  const registry = siblingRegistryPath();
  if (!fs.existsSync(registry)) {
    console.error(`Backend capability registry not found: ${registry}`);
    process.exitCode = 1;
    return;
  }
  const capabilities = readRegistry(registry);
  writeSnapshot(capabilities);
  console.log(`Wrote ${capabilities.length} capabilities to docs/capabilities/catalog.snapshot.json`);
}

if (require.main === module) main();

module.exports = {
  SNAPSHOT,
  siblingRegistryPath,
  readRegistry,
  writeSnapshot,
};
