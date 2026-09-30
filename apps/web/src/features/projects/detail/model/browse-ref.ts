/**
 * The branch the Code tab opens on, given the branches the viewer may see.
 *
 * The backend narrows the branch list by role (a QA or developer list need
 * not contain `main`, and never contains branches that are not theirs), so the
 * repository's default branch cannot be assumed present. Preferred in order:
 * the default branch if it is listed, then `dev`, then the first listed
 * branch; the default branch is the last resort when the list is empty.
 */

import { WORKING_BRANCH } from "@/shared/api/pipeline-branches";

export function browseRefFor(
  branches: readonly string[],
  defaultBranch: string,
): string {
  if (branches.includes(defaultBranch)) return defaultBranch;
  if (branches.includes(WORKING_BRANCH)) return WORKING_BRANCH;
  return branches[0] ?? defaultBranch;
}
