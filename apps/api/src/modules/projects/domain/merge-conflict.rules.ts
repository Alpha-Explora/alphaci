/**
 * Which files a conflicted pull request probably conflicts in: the paths
 * changed on BOTH sides since the branches diverged. GitHub only reports
 * "dirty" for the whole pull request, so this is the closest the product can
 * get without cloning; a path changed on both sides is where Git has to
 * merge two edits, which is where a conflict can be. Pure.
 */
export interface ConflictCandidate {
  path: string;
  /** Lines changed on the pull request's side (head). */
  headChanges: number;
  /** Lines changed on the base branch since the branches diverged. */
  baseChanges: number;
}

export interface ChangedFile {
  filename: string;
  additions: number;
  deletions: number;
  /** The old path of a rename. */
  previousFilename?: string | null;
}

function paths(file: ChangedFile): string[] {
  return file.previousFilename && file.previousFilename !== file.filename
    ? [file.filename, file.previousFilename]
    : [file.filename];
}

/** Paths edited on both sides, sorted by the larger total change first. */
export function conflictCandidates(
  headFiles: readonly ChangedFile[],
  baseFiles: readonly ChangedFile[],
): ConflictCandidate[] {
  const base = new Map<string, ChangedFile>();
  for (const file of baseFiles) {
    for (const path of paths(file)) base.set(path, file);
  }
  const seen = new Set<string>();
  const candidates: ConflictCandidate[] = [];
  for (const file of headFiles) {
    const match = paths(file)
      .map((path) => base.get(path))
      .find(Boolean);
    if (!match || seen.has(file.filename)) continue;
    seen.add(file.filename);
    candidates.push({
      path: file.filename,
      headChanges: file.additions + file.deletions,
      baseChanges: match.additions + match.deletions,
    });
  }
  return candidates.sort(
    (a, b) =>
      b.headChanges + b.baseChanges - (a.headChanges + a.baseChanges) ||
      a.path.localeCompare(b.path),
  );
}
