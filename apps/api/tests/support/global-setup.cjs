const { existsSync } = require('node:fs');
const { delimiter, join } = require('node:path');

/**
 * Jest global setup for the API. Changes go on the real process.env here,
 * because a spec's process.env is a sandboxed copy that child processes never
 * see; the workers, their specs and the processes they spawn inherit this one.
 */
module.exports = function globalSetup() {
  // Specs that boot the app (src/main.ts) would otherwise read the developer's
  // .env.local and .env, so a local setting such as
  // ALPHACI_DEPLOYMENT_MODE=selfhosted fails a run that passes in CI.
  process.env.ALPHACI_IGNORE_ENV_FILE = 'true';

  // Specs run generated pipeline scripts with `bash`. On Windows that name can
  // resolve to WSL's System32\bash.exe, which cannot read a C:\ temp path, so
  // put Git's bash first.
  if (process.platform !== 'win32') return;
  const gitBin = join(process.env.ProgramFiles ?? '', 'Git', 'bin');
  if (existsSync(join(gitBin, 'bash.exe'))) {
    process.env.PATH = `${gitBin}${delimiter}${process.env.PATH}`;
  }
};
