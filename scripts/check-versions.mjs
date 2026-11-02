#!/usr/bin/env node
// Fails when a dependency listed by more than one workspace (the root
// package.json included) has different version ranges there. One range per
// dependency keeps a single copy in the root node_modules and lets configs in
// packages/config assume the same tool version everywhere.
//
//   npm run check:versions
//
// Reads every workspace package.json; needs no install. When two ranges must
// differ on purpose, add the dependency to ALLOWED_DIFFERENCES with the
// reason. An entry whose ranges agree again fails the check, so the list only
// holds live exceptions.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ALLOWED_DIFFERENCES = {
  // 'some-package': 'why the ranges differ on purpose',
};

const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const root = path.resolve(import.meta.dirname, '..');

const readManifest = (directory) =>
  JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));

function workspaceDirectories(patterns) {
  return patterns.flatMap((pattern) => {
    if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) {
      throw new Error(`check:versions: unsupported workspace pattern "${pattern}" (only "dir/*")`);
    }
    const parent = path.join(root, pattern.slice(0, -2));
    return readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parent, entry.name))
      .filter((directory) => existsSync(path.join(directory, 'package.json')));
  });
}

const rootManifest = readManifest(root);
const manifests = [
  { label: '(root)', manifest: rootManifest },
  ...workspaceDirectories(rootManifest.workspaces ?? []).map((directory) => {
    const manifest = readManifest(directory);
    return { label: manifest.name ?? path.relative(root, directory), manifest };
  }),
];

// dependency name -> range -> ["@alphaci/web devDependencies", ...]
const uses = new Map();
for (const { label, manifest } of manifests) {
  for (const section of SECTIONS) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (!uses.has(name)) uses.set(name, new Map());
      const byRange = uses.get(name);
      if (!byRange.has(range)) byRange.set(range, []);
      byRange.get(range).push(`${label} ${section}`);
    }
  }
}

const shared = [...uses].filter(([, byRange]) => [...byRange.values()].flat().length > 1);
const mismatched = shared.filter(([name, byRange]) => byRange.size > 1 && !(name in ALLOWED_DIFFERENCES));
const stale = Object.keys(ALLOWED_DIFFERENCES).filter((name) => (uses.get(name)?.size ?? 0) < 2);

for (const [name, byRange] of mismatched) {
  console.error(`${name}`);
  for (const [range, where] of byRange) console.error(`  ${range.padEnd(14)} ${where.join(', ')}`);
}
for (const name of stale) {
  console.error(`${name}: listed in ALLOWED_DIFFERENCES but no longer has different ranges; remove the entry`);
}

if (mismatched.length > 0 || stale.length > 0) {
  console.error(
    `\ncheck:versions: ${mismatched.length} dependency range mismatch(es), ${stale.length} stale allowlist entr(ies).\n` +
      'Use one range in every package.json (the version package-lock.json already resolves), ' +
      'or add the dependency to ALLOWED_DIFFERENCES in scripts/check-versions.mjs with the reason.',
  );
  process.exit(1);
}

console.log(
  `check:versions: ${shared.length} dependencies are listed by more than one of ${manifests.length} manifests; each uses one range.`,
);
