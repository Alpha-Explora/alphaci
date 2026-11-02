#!/usr/bin/env node
'use strict';

/**
 * Add a capability to the catalog in one command.
 *
 * Adding a capability used to mean editing the registry, up to three
 * manifests, three pack tables, and a frontend surface list, then
 * regenerating two sets of documentation and remembering the ledger. Every
 * one of those is derivable from the record itself, so the command writes the
 * record and derives the rest.
 *
 *   npm run capability:new -- --key projects.example --description "..." \
 *     --editions enterprise --summary "Added the example capability."
 *
 * What it cannot derive is the code: an AppConfig flag named by the record
 * still has to exist, and the command says so rather than pretending.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = require('./lib/composition-source.cjs');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.resolve(ROOT, '..', 'web');
const NOT_IMPLEMENTED_CONFIGURATION = 'Not implemented in this backend. No AppConfig flag.';
const CONTEXT_BY_PREFIX = {
  identity: 'identity-access',
  platform: 'platform-ops',
  billing: 'billing',
  runtime: 'runtime',
  projects: 'projects',
  pipelines: 'pipelines',
};

function option(name, fallback) {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function list(name) {
  return (option(name, '') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function fail(message) {
  console.error('Cannot add the capability: ' + message);
  process.exit(1);
}

const key = option('key');
const description = option('description');
const summary = option('summary');
const reference = option('reference', 'CHANGELOG.md');
const maturity = option('maturity', 'not-implemented');
const editions = list('editions');

if (typeof key !== 'string' || !key.includes('.')) fail('--key must be context.name');
if (typeof description !== 'string' || description.trim() === '') fail('--description is required');
if (typeof summary !== 'string' || summary.trim() === '') fail('--summary is required for the ledger entry');
if (!source.MATURITIES.includes(maturity)) fail('--maturity must be one of ' + source.MATURITIES.join(', '));
if (editions.length === 0) fail('--editions must name the packs that include this capability');

const context = option('context', CONTEXT_BY_PREFIX[key.split('.')[0]]);
if (typeof context !== 'string') fail('--context could not be derived from the key');

const configuration = option(
  'configuration',
  maturity === 'not-implemented' ? NOT_IMPLEMENTED_CONFIGURATION : undefined,
);
if (typeof configuration !== 'string') fail('--configuration is required unless the capability is not-implemented');

const record = {
  key,
  context,
  description: description.trim(),
  maturity,
  configuration,
  configurationFlags: list('flags'),
  requires: list('requires'),
  editions: source.EDITIONS.filter((edition) => editions.includes(edition)),
  surface: {
    apiField: option('api-field', null) ?? null,
    viewFlag: option('view-flag', null) ?? null,
    domains: list('domains'),
    routes: list('routes'),
    featureBarrels: list('barrels'),
    artifactSymbols: list('artifact-symbols'),
  },
};

const document = source.loadSource();
if (document.capabilities.some((entry) => entry.key === key)) fail(key + ' already exists');

let insertAt = document.capabilities.length;
for (let index = document.capabilities.length - 1; index >= 0; index -= 1) {
  if (document.capabilities[index].context === context) {
    insertAt = index + 1;
    break;
  }
}
document.capabilities.splice(insertAt, 0, record);

const errors = source.validateSource(document);
if (errors.length > 0) {
  console.error('The capability was not added: ' + errors.length + ' error(s).');
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}

fs.writeFileSync(source.SOURCE_PATH, JSON.stringify(document, null, 2) + '\n');

const steps = [
  ['scripts/generate-composition-source.mjs'],
  ['scripts/package-capability-catalog.cjs'],
  [
    'scripts/record-capability-ledger.cjs',
    '--change',
    'added',
    '--keys',
    key,
    '--summary',
    summary,
    '--reference',
    reference,
  ],
];
// The web app regenerates its snapshot, surface view, and the three pack profiles from the package.
const webSteps = [
  ['scripts/sync-catalog-snapshot.cjs'],
  ['scripts/generate-capability-surface-registry.cjs'],
  ['scripts/generate-architecture-maps.mjs'],
];

function run(cwd, args) {
  const result = spawnSync(process.execPath, [path.join(cwd, ...args[0].split('/')), ...args.slice(1)], {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) fail('the follow-up step ' + args[0] + ' failed; the source was written and needs review');
}

for (const step of steps) run(ROOT, step);
// The web app's expected provenance record is a copy of the package's own; the
// pull request diff is where the new digest gets reviewed.
fs.copyFileSync(
  path.join(ROOT, '..', '..', 'packages', 'capability-catalog', 'provenance.json'),
  path.join(WEB, 'capabilities', 'catalog.provenance.json'),
);
for (const step of webSteps) run(WEB, step);

console.log('Added ' + key + ' to ' + record.editions.join(', ') + '.');
if (record.configurationFlags.length > 0) {
  console.log(
    'Still to do by hand: add ' +
      record.configurationFlags.join(', ') +
      ' to AppConfig, because a configuration flag is code rather than catalog data.',
  );
}
