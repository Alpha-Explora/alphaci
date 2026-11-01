#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  PROFILE_PACKS,
  loadCatalogPackage,
  readSurfaceRegistry,
  resolveBuildProfile,
  resolveProfile,
  scanBuildOutput,
  stubSource,
} = require('./lib/capability-profile.cjs');

const ROOT = path.resolve(__dirname, '..');
const pkg = loadCatalogPackage();
const surfaces = readSurfaceRegistry();
const requested = process.argv.includes('--profile')
  ? process.argv[process.argv.indexOf('--profile') + 1]
  : null;
const profiles = requested ? [resolveBuildProfile(requested)] : Object.keys(PROFILE_PACKS);
const errors = [];

for (const profile of profiles) {
  const projection = resolveProfile(profile, {
    catalog: pkg.catalog,
    manifests: pkg.manifests,
    surfaces,
  });
  if (JSON.stringify(projection.packs) !== JSON.stringify(PROFILE_PACKS[profile])) {
    errors.push(`${profile}: pack membership is not the declared profile map`);
  }
  if (projection.excludedFeatureBarrels.length > 0) {
    for (const barrel of projection.excludedFeatureBarrels) {
      if (!stubSource(barrel).includes('return notFound();')) {
        errors.push(`${profile}: excluded barrel ${barrel} has no notFound stub`);
      }
    }
  }
}

const outputDirectory = process.argv.includes('--output')
  ? path.resolve(process.argv[process.argv.indexOf('--output') + 1])
  : null;
if (outputDirectory) {
  if (!requested) {
    errors.push('--output requires --profile so one build artifact has one profile projection');
  } else {
    const findings = scanBuildOutput(outputDirectory, resolveProfile(profiles[0], {
      catalog: pkg.catalog,
      manifests: pkg.manifests,
      surfaces,
    }));
    for (const finding of findings) {
      if (typeof finding === 'string') errors.push(finding);
      else errors.push(`${profiles[0]}: excluded artifact symbol ${finding.symbol} found in ${finding.file}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Build profile checks failed: ${errors.length} error(s).`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Build profile checks passed: ${profiles.join(', ')}.`);
}
