'use client';

import { useMemo } from 'react';

import {
  pairSplitRows,
  parseUnifiedDiff,
  type DiffFile,
  type DiffLine,
  type DiffMode,
} from '../../model/unified-diff';
import { useDiffMode } from '../../view-models/use-diff-mode';

/*
 * Files start collapsed past these sizes. A comparison can carry hundreds of
 * files, and rendering every line of every one of them up front is what makes
 * a diff page freeze before the reader has chosen what to look at.
 */
const OPEN_FILE_LIMIT = 20;
const OPEN_CHANGE_LIMIT = 400;

const MARKER: Record<DiffLine['kind'], string> = {
  add: '+',
  del: '−',
  context: ' ',
  hunk: '',
  note: '',
};

const SPOKEN: Record<DiffLine['kind'], string> = {
  add: 'added',
  del: 'removed',
  context: '',
  hunk: '',
  note: '',
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
  const [mode, setMode] = useDiffMode();
  if (files.length === 0) {
    return <p className="ws-hint">No files changed.</p>;
  }

  const openByDefault = files.length <= OPEN_FILE_LIMIT;

  return (
    <div className="ws-diffview">
      <div className="ws-diffmode" role="group" aria-label="Diff layout">
        {(['unified', 'split'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="ws-diffmode__option"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
          >
            {option === 'unified' ? 'Unified' : 'Side by side'}
          </button>
        ))}
      </div>
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
            mode={mode}
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
  mode,
}: Readonly<{ file: DiffFile; open: boolean; mode: DiffMode }>) {
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
            <span className="ws-add">+{file.additions}</span>{' '}
            <span className="ws-del">−{file.deletions}</span>
          </span>
        </summary>
        {file.patch ? (
          <div className="ws-difftable__scroll">
            {mode === 'split' ? (
              <SplitTable lines={lines} />
            ) : (
              <table className="ws-difftable">
                <tbody>
                  {lines.map((line, index) => (
                    <DiffRow key={index} line={line} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <p className="ws-hint">
            Diff not shown — this file is binary, or the change is too large to
            display.
          </p>
        )}
      </details>
    </li>
  );
}

/** Base on the left, head on the right; a changed line reads across. */
function SplitTable({ lines }: Readonly<{ lines: DiffLine[] }>) {
  const rows = useMemo(() => pairSplitRows(lines), [lines]);
  return (
    <table className="ws-difftable ws-difftable--split">
      <thead className="sr-only">
        <tr>
          <th scope="col">Base line</th>
          <th scope="col">Base</th>
          <th scope="col">Head line</th>
          <th scope="col">Head</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) =>
          row.kind === 'full' ? (
            <tr
              key={index}
              className={`ws-diffline ws-diffline--${row.line.kind}`}
            >
              <td className="ws-diffline__code" colSpan={4}>
                {row.line.kind === 'hunk'
                  ? `@@ ${row.line.text}`
                  : row.line.text}
              </td>
            </tr>
          ) : (
            <tr key={index} className="ws-diffline ws-diffline--split">
              <SplitCells line={row.left} side="old" />
              <SplitCells line={row.right} side="new" />
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function SplitCells({
  line,
  side,
}: Readonly<{ line: DiffLine | null; side: 'old' | 'new' }>) {
  if (!line) {
    return (
      <>
        <td
          className="ws-diffline__num ws-diffline__empty"
          aria-hidden="true"
        />
        <td
          className="ws-diffline__code ws-diffline__empty"
          aria-hidden="true"
        />
      </>
    );
  }
  const tone = line.kind === 'context' ? '' : ` ws-diffcell--${line.kind}`;
  return (
    <>
      <td className={`ws-diffline__num${tone}`}>
        {side === 'old' ? line.oldNumber : line.newNumber}
      </td>
      <td className={`ws-diffline__code${tone}`}>
        <span className="sr-only">{SPOKEN[line.kind]} </span>
        {line.text}
      </td>
    </>
  );
}

function DiffRow({ line }: Readonly<{ line: DiffLine }>) {
  if (line.kind === 'hunk' || line.kind === 'note') {
    return (
      <tr className={`ws-diffline ws-diffline--${line.kind}`}>
        <td className="ws-diffline__num" aria-hidden="true" />
        <td className="ws-diffline__num" aria-hidden="true" />
        <td className="ws-diffline__code" colSpan={2}>
          {line.kind === 'hunk' ? `@@ ${line.text}` : line.text}
        </td>
      </tr>
    );
  }

  return (
    <tr className={`ws-diffline ws-diffline--${line.kind}`}>
      <td className="ws-diffline__num">{line.oldNumber ?? ''}</td>
      <td className="ws-diffline__num">{line.newNumber ?? ''}</td>
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
