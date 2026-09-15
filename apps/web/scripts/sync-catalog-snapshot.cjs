'use strict';

// Migration helper only. Active checks and builds consume the versioned local
// @alphaci/capability-catalog fixture; this script is retained for refreshing
// the richer documentation snapshot while a package registry is introduced.

const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'docs/capabilities/catalog.snapshot.json');

function siblingRegistryPath() {
  if (process.env.ALPHACI_BE_ROOT) {
    return path.join(
      process.env.ALPHACI_BE_ROOT,
      'src/kernel/composition/capability-registry.ts',
    );
  }
  return path.resolve(
    ROOT,
    '..',
    'alphaci-enterprise-be',
    'src/kernel/composition/capability-registry.ts',
  );
}

function siblingCatalogPath() {
  if (process.env.ALPHACI_BE_ROOT) {
    return path.join(
      process.env.ALPHACI_BE_ROOT,
      'packages/capability-catalog/catalog.json',
    );
  }
  return path.resolve(
    ROOT,
    '..',
    'alphaci-enterprise-be',
    'packages/capability-catalog/catalog.json',
  );
}

function readRegistry(file) {
  const source = fs.readFileSync(file, 'utf8');
  const backendRoot = path.resolve(path.dirname(file), '..', '..', '..');
  const typescript = require(path.join(backendRoot, 'node_modules', 'typescript'));
  const output = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  });
  const compiledModule = { exports: {} };
  new Function('require', 'exports', 'module', output.outputText)(
    createRequire(file),
    compiledModule.exports,
    compiledModule,
  );
  if (!Array.isArray(compiledModule.exports.CAPABILITIES)) {
    throw new Error(`${file} must export a CAPABILITIES array`);
  }
  return compiledModule.exports.CAPABILITIES;
}

function readCatalog(file) {
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(catalog)) {
    throw new Error(`${file} must contain a JSON capability catalog array`);
  }
  return catalog;
}

function writeSnapshot(capabilities) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify(capabilities, null, 2)}\n`, 'utf8');
}

function main() {
  const registry = siblingRegistryPath();
  const catalog = siblingCatalogPath();
  if (!fs.existsSync(registry) || !fs.existsSync(catalog)) {
    console.error(
      `Backend kernel registry and generated catalog are required: ${registry}; ${catalog}`,
    );
    process.exitCode = 1;
    return;
  }
  const records = readRegistry(registry);
  const editionByKey = new Map(
    readCatalog(catalog).map((record) => [record.key, record.editions]),
  );
  const capabilities = records.map((record) => {
    if (!editionByKey.has(record.key)) {
      throw new Error(`Generated catalog is missing editions for ${record.key}`);
    }
    return {
      key: record.key,
      context: record.context,
      description: record.description,
      maturity: record.maturity,
      editions: editionByKey.get(record.key),
      configuration: record.configuration,
      configurationFlags: record.configurationFlags,
      requires: record.requires,
    };
  });
  writeSnapshot(capabilities);
  console.log(`Wrote ${capabilities.length} capabilities to docs/capabilities/catalog.snapshot.json`);
}

if (require.main === module) main();

module.exports = {
  SNAPSHOT,
  siblingCatalogPath,
  siblingRegistryPath,
  readCatalog,
  readRegistry,
  writeSnapshot,
};
