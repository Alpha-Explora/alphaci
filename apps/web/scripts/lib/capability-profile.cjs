'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Resolved through the npm workspace, so it follows packages/capability-catalog.
const PACKAGE_DIR = path.dirname(require.resolve('@alphaci/capability-catalog'));
const PROFILE_PACKS = Object.freeze({
  hosted: Object.freeze(['saas', 'edu']),
  enterprise: Object.freeze(['enterprise']),
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadCatalogPackage(packageDirectory = PACKAGE_DIR) {
  const metadata = readJson(path.join(packageDirectory, 'package.json'));
  const catalog = readJson(path.join(packageDirectory, 'catalog.json'));
  return {
    metadata,
    version: metadata.version,
    catalog,
    manifests: readJson(path.join(packageDirectory, 'manifests.json')),
    surfaces: catalog.map((record) => {
      if (!record.surface) {
        throw new Error(`capability ${record.key} is missing its published surface`);
      }
      return { key: record.key, ...record.surface };
    }),
  };
}

function readSurfaceRegistry() {
  return loadCatalogPackage().surfaces;
}

function resolveBuildProfile(value = process.env.ALPHACI_BUILD_PROFILE || 'enterprise') {
  if (Object.prototype.hasOwnProperty.call(PROFILE_PACKS, value)) return value;
  throw new Error(`Unknown ALPHACI_BUILD_PROFILE ${JSON.stringify(value)}; expected hosted or enterprise`);
}

function dependencyClosure(keys, catalog) {
  const byKey = new Map(catalog.map((record) => [record.key, record]));
  const result = new Set(keys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...result]) {
      const record = byKey.get(key);
      if (!record) throw new Error(`Manifest references unknown capability ${key}`);
      for (const required of record.requires) {
        if (!result.has(required)) {
          result.add(required);
          changed = true;
        }
      }
    }
  }
  return result;
}

function resolveProfile(profile, input) {
  const packs = PROFILE_PACKS[profile];
  if (!packs) throw new Error(`Unknown build profile ${JSON.stringify(profile)}`);
  const catalog = input.catalog;
  const manifests = input.manifests;
  const surfaces = input.surfaces;
  const profileManifestKeys = new Set(
    packs.flatMap((pack) => manifests[pack] || []),
  );
  const selected = dependencyClosure([...profileManifestKeys], catalog);
  const outsideProfile = [...selected].filter((key) => !profileManifestKeys.has(key));
  if (outsideProfile.length > 0) {
    throw new Error(
      `${profile} dependency closure exceeds its pack ceiling: ${outsideProfile.join(', ')}`,
    );
  }
  const catalogKeys = catalog.map((record) => record.key);
  const includedCapabilityKeys = catalogKeys.filter((key) => selected.has(key));
  const excludedCapabilityKeys = catalogKeys.filter((key) => !selected.has(key));
  const includedFeatureBarrels = [...new Set(
    surfaces
      .filter((surface) => selected.has(surface.key))
      .flatMap((surface) => surface.featureBarrels || []),
  )];
  const excludedSurfaces = surfaces.filter((surface) => !selected.has(surface.key));
  const excludedFeatureBarrels = [...new Set(
    excludedSurfaces
      .flatMap((surface) => surface.featureBarrels || [])
      .filter((barrel) => !includedFeatureBarrels.includes(barrel)),
  )];
  const includedArtifactSymbols = [...new Set(
    surfaces
      .filter((surface) => selected.has(surface.key))
      .flatMap((surface) => surface.artifactSymbols || []),
  )];
  const excludedArtifactSymbols = [...new Set(
    excludedSurfaces
      .flatMap((surface) => surface.artifactSymbols || [])
      .filter((symbol) => !includedArtifactSymbols.includes(symbol)),
  )];
  return Object.freeze({
    profile,
    packs: [...packs],
    includedCapabilityKeys,
    excludedCapabilityKeys,
    includedFeatureBarrels,
    excludedFeatureBarrels,
    includedArtifactSymbols,
    excludedArtifactSymbols,
    excludedSurfaces,
  });
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

function scanBuildOutput(outputDirectory, projection) {
  if (!fs.existsSync(outputDirectory)) {
    return [`build output does not exist: ${outputDirectory}`];
  }
  const entries = filesUnder(outputDirectory).filter((file) =>
    /\.(?:js|mjs|cjs)$/.test(file),
  );
  const findings = [];
  for (const file of entries) {
    const content = fs.readFileSync(file, 'utf8');
    for (const symbol of projection.excludedArtifactSymbols) {
      const pattern = new RegExp(`\\b${escapeRegExp(symbol)}\\b`);
      if (pattern.test(content)) findings.push({ symbol, file });
    }
  }
  return findings;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// artifactSymbols are implementation names that the profile scanner proves absent.
// Fail-closed aliases expose only a default notFound entry so they cannot satisfy
// an implementation-symbol scan accidentally.
function stubSource(barrel) {
  const name = barrel.split('/').pop() || 'excludedFeature';
  const identifier = name.replace(/[^A-Za-z0-9_$]/g, '_');
  return `import { notFound } from "next/navigation";\n\nfunction ${identifier}(): never {\n  return notFound();\n}\n\nexport default ${identifier};\n`;
}

function stubFileName(barrel) {
  return `${barrel.replace(/^@\//, '').replace(/[^A-Za-z0-9_-]/g, '__')}.tsx`;
}

function createAliasEntries(projection, stubDirectory) {
  return Object.fromEntries(
    projection.excludedFeatureBarrels.map((barrel) => [
      barrel,
      path.join(stubDirectory, stubFileName(barrel)),
    ]),
  );
}

function writeCapabilityStubs(projection, stubDirectory) {
  fs.rmSync(stubDirectory, { recursive: true, force: true });
  fs.mkdirSync(stubDirectory, { recursive: true });
  for (const barrel of projection.excludedFeatureBarrels) {
    fs.writeFileSync(
      path.join(stubDirectory, stubFileName(barrel)),
      stubSource(barrel),
      'utf8',
    );
  }
  return createAliasEntries(projection, stubDirectory);
}

module.exports = {
  PACKAGE_DIR,
  PROFILE_PACKS,
  createAliasEntries,
  loadCatalogPackage,
  readSurfaceRegistry,
  resolveBuildProfile,
  resolveProfile,
  scanBuildOutput,
  stubFileName,
  stubSource,
  writeCapabilityStubs,
};
