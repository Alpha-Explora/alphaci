'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROVENANCE_SCHEMA_VERSION = 1;
const PACKAGE_NAME = '@alphaci/capability-catalog';
const SOURCE_REPOSITORY = 'github.com/Alpha-Explora/alphaci-golden-copy-be';
const AUTHORITATIVE_SOURCE = 'src/kernel/composition/catalog.source.json';
const PROVENANCE_FILE = 'provenance.json';

// Keep this contract identical to the backend package generator. The
// provenance file is excluded because including it would be self-referential.
const CANONICAL_PACKAGE_FILES = Object.freeze([
  'package.json',
  'catalog.json',
  'index.d.ts',
  'index.js',
  'manifests.json',
]);

function normalizeFileText(value) {
  return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function artifactDigestFromContents(files) {
  const canonicalContents = CANONICAL_PACKAGE_FILES.map((file) => {
    if (!Object.prototype.hasOwnProperty.call(files, file)) {
      throw new Error(`canonical package file is missing: ${file}`);
    }
    return [file, normalizeFileText(files[file])];
  });
  return sha256(JSON.stringify(canonicalContents));
}

function artifactDigestFromDirectory(packageDirectory) {
  const files = Object.fromEntries(
    CANONICAL_PACKAGE_FILES.map((file) => [
      file,
      fs.readFileSync(path.join(packageDirectory, file), 'utf8'),
    ]),
  );
  return artifactDigestFromContents(files);
}

function provenanceShapeErrors(provenance, packageVersion) {
  const errors = [];
  if (!provenance || typeof provenance !== 'object') {
    return ['provenance.json must contain an object'];
  }
  if (provenance.schemaVersion !== PROVENANCE_SCHEMA_VERSION) {
    errors.push(`provenance schemaVersion must be ${PROVENANCE_SCHEMA_VERSION}`);
  }
  if (provenance.packageName !== PACKAGE_NAME) {
    errors.push(`provenance packageName must be ${PACKAGE_NAME}`);
  }
  if (provenance.packageVersion !== packageVersion) {
    errors.push('provenance packageVersion does not match package.json');
  }
  if (provenance.sourceRepository !== SOURCE_REPOSITORY) {
    errors.push(`provenance sourceRepository must be ${SOURCE_REPOSITORY}`);
  }
  if (provenance.authoritativeSource !== AUTHORITATIVE_SOURCE) {
    errors.push(`provenance authoritativeSource must be ${AUTHORITATIVE_SOURCE}`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(provenance.catalogSourceDigest || '')) {
    errors.push('provenance catalogSourceDigest must be a sha256 digest');
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(provenance.artifactDigest || '')) {
    errors.push('provenance artifactDigest must be a sha256 digest');
  }
  if (JSON.stringify(provenance.canonicalFiles) !== JSON.stringify(CANONICAL_PACKAGE_FILES)) {
    errors.push('provenance canonicalFiles do not match the package digest contract');
  }
  return errors;
}

module.exports = {
  AUTHORITATIVE_SOURCE,
  CANONICAL_PACKAGE_FILES,
  PACKAGE_NAME,
  PROVENANCE_FILE,
  PROVENANCE_SCHEMA_VERSION,
  SOURCE_REPOSITORY,
  artifactDigestFromContents,
  artifactDigestFromDirectory,
  normalizeFileText,
  provenanceShapeErrors,
};
