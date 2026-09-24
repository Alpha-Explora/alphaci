"use client";

import { useMemo } from "react";

import {
  parseUnifiedDiff,
  type DiffFile,
  type DiffLine,
} from "../../model/unified-diff";

/*
 * Files start collapsed past these sizes. A comparison can carry hundreds of
 * files, and rendering every line of every one of them up front is what makes
 * a diff page freeze before the reader has chosen what to look at.
 */
const OPEN_FILE_LIMIT = 20;
const OPEN_CHANGE_LIMIT = 400;

const MARKER: Record<DiffLine["kind"], string> = {
  add: "+",
  del: "−",
  context: " ",
  hunk: "",
  note: "",
};

const SPOKEN: Record<DiffLine["kind"], string> = {
  add: "added",
  del: "removed",
  context: "",
  hunk: "",
  note: "",
};

/**
 * Changed files as a readable diff: line numbers for both sides, additions and
 * deletions coloured, one collapsible block per file.
 *
 * Shared by the compose screen and an open pull request, so a change looks the
 * same before and after it is proposed.
 */
export function DiffView({
  files,
  truncated = false,
}: Readonly<{ files: DiffFile[]; truncated?: boolean }>) {
  if (files.length === 0) {
    return <p className="ws-hint">No files changed.</p>;
  }

  const openByDefault = files.length <= OPEN_FILE_LIMIT;

  return (
    <div className="ws-diffview">
      {truncated && (
        <p className="ws-hint">
          GitHub lists only the first {files.length} changed files of a
          comparison this large. The pull request will contain all of them.
        </p>
      )}
      <ul className="ws-files">
        {files.map((file) => (
          <DiffFileBlock
            key={file.filename}
            file={file}
            open={
              openByDefault &&
              file.additions + file.deletions <= OPEN_CHANGE_LIMIT
            }
          />
        ))}
      </ul>
    </div>
  );
}

function DiffFileBlock({
  file,
  open,
}: Readonly<{ file: DiffFile; open: boolean }>) {
  // Parsed once per file, and only when the file has a patch at all.
  const lines = useMemo(
    () => (file.patch ? parseUnifiedDiff(file.patch) : []),
    [file.patch],
  );

  return (
    <li className="ws-file-row">
      <details className="ws-difffile" open={open}>
        <summary className="ws-file-row__head">
          <span className={`ws-pill ws-pill--${file.status}`}>
            {file.status}
          </span>
          <span className="ws-file-row__name">{file.filename}</span>
          <span className="ws-file-row__counts">
            <span className="ws-add">+{file.additions}</span>{" "}
            <span className="ws-del">−{file.deletions}</span>
          </span>
        </summary>
        {file.patch ? (
          <div className="ws-difftable__scroll">
            <table className="ws-difftable">
              <tbody>
                {lines.map((line, index) => (
                  <DiffRow key={index} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ws-hint">
            Diff not shown — this file is binary, or the change is too large
            to display.
          </p>
        )}
      </details>
    </li>
  );
}

function DiffRow({ line }: Readonly<{ line: DiffLine }>) {
  if (line.kind === "hunk" || line.kind === "note") {
    return (
      <tr className={`ws-diffline ws-diffline--${line.kind}`}>
        <td className="ws-diffline__num" aria-hidden="true" />
        <td className="ws-diffline__num" aria-hidden="true" />
        <td className="ws-diffline__code" colSpan={2}>
          {line.kind === "hunk" ? `@@ ${line.text}` : line.text}
        </td>
      </tr>
    );
  }

  return (
    <tr className={`ws-diffline ws-diffline--${line.kind}`}>
      <td className="ws-diffline__num">{line.oldNumber ?? ""}</td>
      <td className="ws-diffline__num">{line.newNumber ?? ""}</td>
      {/* The marker is announced so a screen reader user hears which side a
          line is on; colour alone would say nothing to them. */}
      <td className="ws-diffline__marker">
        <span aria-hidden="true">{MARKER[line.kind]}</span>
        <span className="sr-only">{SPOKEN[line.kind]}</span>
      </td>
      <td className="ws-diffline__code">{line.text}</td>
    </tr>
  );
}
