#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  resolveBuildProfile,
} = require('./lib/capability-profile.cjs');

const profileIndex = process.argv.indexOf('--profile');
const requested = profileIndex >= 0 ? process.argv[profileIndex + 1] : undefined;
const profile = resolveBuildProfile(requested);
const nextBin = require.resolve('next/dist/bin/next');
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: process.cwd(),
  env: { ...process.env, ALPHACI_BUILD_PROFILE: profile },
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
if (process.exitCode === 0) {
  const check = spawnSync(
    process.execPath,
    [require.resolve('./check-build-profiles.cjs'), '--profile', profile, '--output', path.join(process.cwd(), '.next')],
    { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
  );
  process.exitCode = check.status ?? 1;
}
