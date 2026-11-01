/**
 * A unified diff, as GitHub returns it in a file's `patch`, turned into lines
 * that know where they sit in the old and the new file.
 *
 * The raw patch used to be dumped into a <pre>, which showed the change but
 * gave no line an identity. Line numbers are what a reader uses to find their
 * place, and what an inline review comment has to point at (GitHub anchors one
 * to a line on a side), so the parse is the foundation for both.
 *
 * Pure: no React, no fetch. GitHub's `patch` has no `---`/`+++` file header —
 * it starts at the first `@@` — so none is expected here.
 */

export type DiffLineKind = "hunk" | "context" | "add" | "del" | "note";

/**
 * One changed file, as far as a diff renderer needs it. Both a pull request's
 * files and a branch comparison's files have this shape, which is what lets
 * one renderer serve the preview before a pull request exists and the pull
 * request after.
 */
export interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  /** Null when GitHub withheld it: a binary file or a very large change. */
  patch: string | null;
}

export interface DiffLine {
  kind: DiffLineKind;
  /** The line without its leading marker (`+`, `-`, space). */
  text: string;
  /** Line number in the base file; null for additions, hunks and notes. */
  oldNumber: number | null;
  /** Line number in the head file; null for deletions, hunks and notes. */
  newNumber: number | null;
}

/** `@@ -12,7 +12,9 @@ optional section heading` */
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

export function parseUnifiedDiff(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    const hunk = HUNK_HEADER.exec(raw);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      lines.push({
        kind: "hunk",
        // The section heading (usually the enclosing function) is the useful
        // part; the ranges are already expressed by the line numbers.
        text: (hunk[3] ?? "").trim(),
        oldNumber: null,
        newNumber: null,
      });
      continue;
    }

    const marker = raw.charAt(0);
    const text = raw.slice(1);

    if (marker === "+") {
      lines.push({ kind: "add", text, oldNumber: null, newNumber: newLine });
      newLine += 1;
    } else if (marker === "-") {
      lines.push({ kind: "del", text, oldNumber: oldLine, newNumber: null });
      oldLine += 1;
    } else if (marker === "\\") {
      // "\ No newline at end of file" describes the line above it; it is not
      // a line of either file and must not advance either counter.
      lines.push({
        kind: "note",
        text: raw.slice(2),
        oldNumber: null,
        newNumber: null,
      });
    } else if (marker === " ") {
      lines.push({
        kind: "context",
        text,
        oldNumber: oldLine,
        newNumber: newLine,
      });
      oldLine += 1;
      newLine += 1;
    }
    // Anything else — the empty string after a trailing newline — is not part
    // of the diff and is dropped rather than rendered as a blank context row.
  }

  return lines;
}
