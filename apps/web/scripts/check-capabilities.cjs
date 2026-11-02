#!/usr/bin/env node
'use strict';

/**
 * Binds the frontend capability surface map to the versioned catalog package
 * and the live compatibility response shape.
 *
 * The backend owns capability keys, maturity, pack applicability, and surface
 * data in the @alphaci/capability-catalog workspace package.
 *
 * Checks:
 *   1. every package capability has a surface block
 *   2. every CapabilitiesResponse field is claimed by one apiField
 *   3. every CapabilityViewFlags *Enabled leaf is claimed by one viewFlag
 *   4. pack profiles list every package key in order with derived status
 */

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..');
const { loadCatalogPackage } = require('./lib/capability-profile.cjs');

const CONTRACTS = path.join(ROOT, 'src/shared/api/contracts.ts');
const VIEW_FLAGS = path.join(
  ROOT,
  'src/features/capabilities/current/model/capability-flags.ts',
);

const PACK_STATUSES = new Set([
  'available',
  'configuration-gated',
  'not-implemented',
  'not-applicable',
]);
const PACK_PROFILES = [
  { edition: 'saas', file: 'docs/packs/saas/pack.md' },
  { edition: 'edu', file: 'docs/packs/edu/pack.md' },
  { edition: 'enterprise', file: 'docs/packs/enterprise/pack.md' },
];
const NON_CAPABILITY_VIEW_FLAGS = new Set([
  'deploymentOwnershipMode',
  'hierarchyGithubSyncMode',
]);
const NON_CAPABILITY_API_FIELDS = new Set(['edition', 'capabilityKeys']);

function expectedPackStatus(capability, edition) {
  if (!(capability.editions ?? []).includes(edition)) return 'not-applicable';
  if (capability.maturity === 'stable') return 'available';
  if (capability.maturity === 'limited') return 'configuration-gated';
  return 'not-implemented';
}

function parsePackCapabilityRows(markdown) {
  const heading = /^## Capability status\s*$/m.exec(markdown);
  if (!heading) return { error: 'missing ## Capability status heading' };
  const rest = markdown.slice(heading.index + heading[0].length);
  const nextHeading = /^## /m.exec(rest);
  const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  const rows = [];
  for (const line of section.split(/\r?\n/)) {
    const match = /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (match) rows.push({ key: match[1], status: match[2] });
  }
  return { rows };
}

function readInterfaceFields(source, interfaceName) {
  const header = new RegExp(
    `export (?:interface|type) ${interfaceName}(?:\\s*=)?\\s*\\{`,
  );
  const match = header.exec(source);
  if (!match) throw new Error(`Could not locate ${interfaceName}`);

  let depth = 1;
  let index = match.index + match[0].length;
  const bodyStart = index;
  while (index < source.length && depth > 0) {
    const character = source[index];
    if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    index += 1;
  }
  const body = source.slice(bodyStart, index - 1);
  const fields = [];
  for (const line of body.split(/\r?\n/)) {
    const field = /^ {2}([A-Za-z][A-Za-z0-9]*)(\?)?:/.exec(line);
    if (field) fields.push(field[1]);
  }
  if (fields.length === 0) {
    throw new Error(`${interfaceName} did not expose any top-level fields`);
  }
  return fields;
}

function surfaceCatalogErrors(capabilities, surfaces) {
  const errors = [];
  const max = Math.max(capabilities.length, surfaces.length);
  const seenApi = new Map();
  const seenFlags = new Map();

  for (let index = 0; index < max; index += 1) {
    const expected = capabilities[index];
    const actual = surfaces[index];
    const at = `@alphaci/capability-catalog surface ${index + 1}`;
    if (!expected) {
      errors.push(`${at}: extra surface key ${actual.key}`);
      continue;
    }
    if (!actual) {
      errors.push(`${at}: missing package key ${expected.key}`);
      continue;
    }
    if (actual.key !== expected.key) {
      errors.push(`${at}: expected ${expected.key} in package order, found ${actual.key}`);
    }
    if (actual.apiField != null) {
      if (seenApi.has(actual.apiField)) {
        errors.push(`${at}: apiField ${actual.apiField} already claimed by ${seenApi.get(actual.apiField)}`);
      } else {
        seenApi.set(actual.apiField, actual.key);
      }
    }
    if (actual.viewFlag != null) {
      if (seenFlags.has(actual.viewFlag)) {
        errors.push(`${at}: viewFlag ${actual.viewFlag} already claimed by ${seenFlags.get(actual.viewFlag)}`);
      } else {
        seenFlags.set(actual.viewFlag, actual.key);
      }
    }
    if (!Array.isArray(actual.domains) || !Array.isArray(actual.routes)) {
      errors.push(`${at}: domains and routes must be arrays`);
    }
  }

  const contractFields = readInterfaceFields(
    fs.readFileSync(CONTRACTS, 'utf8'),
    'CapabilitiesResponse',
  );
  for (const field of contractFields) {
    if (NON_CAPABILITY_API_FIELDS.has(field)) continue;
    if (!seenApi.has(field)) {
      errors.push(
        `src/shared/api/contracts.ts: CapabilitiesResponse.${field} is not claimed by any package surface apiField`,
      );
    }
  }
  for (const [field, key] of seenApi.entries()) {
    if (!contractFields.includes(field)) {
      errors.push(
        `@alphaci/capability-catalog: apiField ${field} for ${key} is not a CapabilitiesResponse field`,
      );
    }
  }

  const viewFields = readInterfaceFields(
    fs.readFileSync(VIEW_FLAGS, 'utf8'),
    'CapabilityViewFlags',
  );
  for (const field of viewFields) {
    if (NON_CAPABILITY_VIEW_FLAGS.has(field)) continue;
    if (!seenFlags.has(field)) {
      errors.push(
        `src/features/capabilities/current/model/capability-flags.ts: ${field} is not claimed by any package surface viewFlag`,
      );
    }
  }
  for (const [field, key] of seenFlags.entries()) {
    if (!viewFields.includes(field)) {
      errors.push(
        `@alphaci/capability-catalog: viewFlag ${field} for ${key} is not a CapabilityViewFlags field`,
      );
    }
  }

  return errors;
}

function packCatalogErrors(capabilities) {
  const errors = [];
  for (const pack of PACK_PROFILES) {
    const file = path.join(REPO, pack.file);
    if (!fs.existsSync(file)) {
      errors.push(`${pack.file}: pack profile is missing`);
      continue;
    }
    const parsed = parsePackCapabilityRows(fs.readFileSync(file, 'utf8'));
    if (parsed.error) {
      errors.push(`${pack.file}: ${parsed.error}`);
      continue;
    }
    const rows = parsed.rows;
    if (rows.length === 0) {
      errors.push(`${pack.file}: Capability status table has no capability rows`);
      continue;
    }
    const max = Math.max(rows.length, capabilities.length);
    for (let index = 0; index < max; index += 1) {
      const expected = capabilities[index];
      const actual = rows[index];
      const at = `${pack.file} row ${index + 1}`;
      if (!expected) {
        errors.push(`${at}: extra capability key ${actual.key}`);
        continue;
      }
      if (!actual) {
        errors.push(`${at}: missing capability key ${expected.key}`);
        continue;
      }
      if (actual.key !== expected.key) {
        errors.push(`${at}: expected ${expected.key} in package order, found ${actual.key}`);
      }
      if (!PACK_STATUSES.has(actual.status)) {
        errors.push(`${at}: unknown pack status ${actual.status}`);
        continue;
      }
      const expectedStatus = expectedPackStatus(expected, pack.edition);
      if (actual.status !== expectedStatus) {
        errors.push(
          `${at}: ${expected.key} must be ${expectedStatus} for ${pack.edition} (maturity ${expected.maturity})`,
        );
      }
    }
  }
  return errors;
}

function collect() {
  let catalogPackage;
  try {
    catalogPackage = loadCatalogPackage();
  } catch (error) {
    return [`@alphaci/capability-catalog: ${error.message}`];
  }
  const capabilities = catalogPackage.catalog;
  const surfaces = catalogPackage.surfaces;
  return [
    ...surfaceCatalogErrors(capabilities, surfaces),
    ...packCatalogErrors(capabilities),
  ];
}

function main() {
  const errors = collect();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ errors }, null, 2));
  } else if (errors.length > 0) {
    console.error(`Capability surface check failed: ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`  ${error}`));
  } else {
    console.log('Capability surface checks passed: package surfaces, compatibility fields, and pack catalogs.');
  }
  process.exitCode = errors.length > 0 ? 1 : 0;
}

if (require.main === module) main();

module.exports = {
  collect,
  expectedPackStatus,
};
