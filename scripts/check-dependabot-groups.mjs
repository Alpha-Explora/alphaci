#!/usr/bin/env node
// Fails when a wildcard in a named Dependabot group is missing from the
// exclude-patterns of a `dependency-type` group in the same ecosystem.
//
//   npm run check:dependabot
//
// Dependabot gives an update to the most specific group that matches, and it
// ranks `dependency-type` above a wildcard pattern. A wildcard the catch-all
// groups do not exclude therefore never reaches its named group: that split
// stylelint 18 from stylelint-config-standard 41 and @nestjs/core from
// @nestjs/testing. Exact names win on their own and need no exclusion.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';

const file = path.resolve(
  import.meta.dirname,
  '..',
  '.github',
  'dependabot.yml',
);
const config = load(readFileSync(file, 'utf8'));

const problems = [];
for (const update of config.updates ?? []) {
  const groups = Object.entries(update.groups ?? {});
  const wildcards = groups
    .filter(([, rules]) => !rules['dependency-type'])
    .flatMap(([name, rules]) =>
      (rules.patterns ?? [])
        .filter((p) => p.includes('*') && p !== '*')
        .map((p) => [name, p]),
    );
  for (const [catchAll, rules] of groups) {
    if (!rules['dependency-type']) continue;
    const excluded = new Set(rules['exclude-patterns'] ?? []);
    for (const [group, pattern] of wildcards) {
      if (!excluded.has(pattern)) {
        problems.push(
          `${update['package-ecosystem']}: '${pattern}' (group ${group}) is missing from ` +
            `the exclude-patterns of ${catchAll}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`check:dependabot: ${file}`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    'Dependabot would put these packages in the catch-all group instead. Add each pattern ' +
      "to that group's exclude-patterns.",
  );
  process.exit(1);
}
console.log('check:dependabot: every wildcard group can receive its updates.');
