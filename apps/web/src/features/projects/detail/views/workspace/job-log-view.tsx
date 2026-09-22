"use client";

import { useMemo } from "react";

import {
  parseJobLog,
  summarizeJobLog,
  type JobLogSection,
  type ToolResult,
} from "@/features/runs";

/**
 * A job's log, read as the tools that wrote it.
 *
 * What this replaces: one `<pre>` holding every tool's output in one stream,
 * with GitHub's timestamps and group markers still in it. The answer to "what
 * broke" was in there, in the same weight as four hundred lines of dependency
 * resolution.
 *
 * Two readings, because there are two questions. The roster answers "what ran
 * and what did each one say" in a line per tool, with the tool's own numbers.
 * The sections answer "show me", and only the failed ones are open: a green
 * step's output is evidence nobody asked for, but it is one click away rather
 * than gone.
 *
 * An unparsed log falls back to the raw blob. A format we did not recognise is
 * still evidence, and must not be presented as a job that did nothing.
 */
export function JobLogView({
  content,
  truncated,
}: Readonly<{ content: string; truncated: boolean }>) {
  const sections = useMemo(() => parseJobLog(content), [content]);
  const results = useMemo(() => summarizeJobLog(sections), [sections]);

  if (sections.length === 0) {
    return (
      <>
        <TruncationNote truncated={truncated} />
        <pre className="ws-console">
          <code>{content}</code>
        </pre>
      </>
    );
  }

  return (
    <div className="ws-joblog">
      <TruncationNote truncated={truncated} />
      <ToolRoster results={results} />
      <ol className="ws-joblog__sections">
        {sections.map((section, index) => (
          <LogSection key={`${String(index)}-${section.title}`} section={section} />
        ))}
      </ol>
    </div>
  );
}

function TruncationNote({ truncated }: Readonly<{ truncated: boolean }>) {
  if (!truncated) return null;
  return (
    <p className="ws-hint">
      Showing the end of the log — the earlier output was too long to send, so
      the first steps may be missing.
    </p>
  );
}

const MARK: Record<ToolResult["outcome"], string> = {
  passed: "✓",
  failed: "✗",
  unknown: "–",
};

/** One line per tool: what it is, how it went, and its own numbers. */
function ToolRoster({ results }: Readonly<{ results: ToolResult[] }>) {
  if (results.length === 0) return null;

  return (
    <ul className="ws-toolsum">
      {results.map((result, index) => (
        <li
          key={`${result.tool}-${String(index)}`}
          className={`ws-toolsum__row ws-toolsum__row--${result.outcome}`}
        >
          <span aria-hidden="true" className="ws-toolsum__mark">
            {MARK[result.outcome]}
          </span>
          <span className="ws-toolsum__name">{result.label}</span>
          <span className="ws-toolsum__detail">
            {result.summary ?? (result.outcome === "failed" ? "failed" : "")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LogSection({ section }: Readonly<{ section: JobLogSection }>) {
  return (
    <li className="ws-joblog__section">
      <details open={section.failed}>
        <summary className="ws-joblog__summary">
          <span
            aria-hidden="true"
            className={`ws-joblog__mark ws-joblog__mark--${section.failed ? "failed" : "passed"}`}
          >
            {section.failed ? "✗" : "✓"}
          </span>
          <span className="ws-joblog__title">{section.title}</span>
          {section.durationSeconds !== null && (
            <span className="ws-joblog__time">
              {formatDuration(section.durationSeconds)}
            </span>
          )}
        </summary>
        <pre className="ws-console">
          <code>
            {section.lines.map((line, index) => (
              <span
                key={index}
                className={
                  line.severity === "plain"
                    ? "ws-console__line"
                    : `ws-console__line ws-console__line--${line.severity}`
                }
              >
                {line.text || " "}
                {"\n"}
              </span>
            ))}
          </code>
        </pre>
      </details>
    </li>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0
    ? `${String(minutes)}m`
    : `${String(minutes)}m ${String(rest)}s`;
}
