const { existsSync } = require('node:fs');
const { delimiter, join } = require('node:path');

/**
 * Specs run generated pipeline scripts with `bash`. On Windows that name can
 * resolve to WSL's System32\bash.exe, which cannot read a C:\ temp path, so put
 * Git's bash first. A global setup, because a spec's process.env is a sandboxed
 * copy that child processes never see; the workers inherit this one.
 */
module.exports = function preferGitBash() {
  if (process.platform !== 'win32') return;
  const gitBin = join(process.env.ProgramFiles ?? '', 'Git', 'bin');
  if (existsSync(join(gitBin, 'bash.exe'))) {
    process.env.PATH = `${gitBin}${delimiter}${process.env.PATH}`;
  }
};
