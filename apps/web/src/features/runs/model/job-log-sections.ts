/**
 * A raw GitHub Actions job log, cut into the steps that produced it.
 *
 * The log arrives as one blob: every tool's output in one stream, each line
 * prefixed with an ISO timestamp, wrapped in GitHub's `##[group]` markers and
 * peppered with ANSI colour codes. Rendered as-is it is a wall of text in
 * which the one line that matters — the error — reads exactly like the 400
 * lines of dependency resolution above it.
 *
 * The structure is already in the log; nothing here invents it. GitHub opens a
 * group per step, titled with the command it is about to run, so the groups ARE
 * the steps and the text between them is that step's output.
 *
 * Pure: no React, no fetch. The same parse feeds the summary and the sections.
 */

/** ANSI SGR sequences. Colour in a terminal, noise in HTML. */
const ANSI = /\u001B\[[\d;]*m/g;

/** GitHub prefixes every line with the instant it was written. */
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?/;

const GROUP_START = "##[group]";
const GROUP_END = "##[endgroup]";

/** A step that ends like this failed, whether or not it also logged an error. */
const EXIT_CODE = /Process completed with exit code (\d+)/;

export type JobLogSeverity = "error" | "warning" | "plain";

export interface JobLogLine {
  text: string;
  severity: JobLogSeverity;
}

export interface JobLogSection {
  /** The step's title, as GitHub titled the group, e.g. "Run npm run lint". */
  title: string;
  /** The command the step ran, when the title named one. */
  command: string | null;
  lines: JobLogLine[];
  failed: boolean;
  /**
   * Wall-clock seconds the step took, when the log is timestamped.
   *
   * A step ends where the next one starts, not at its own last line: a tool
   * that prints nothing while it works would otherwise report a duration of
   * zero and read as though it never ran.
   */
  durationSeconds: number | null;
}

interface SectionDraft {
  title: string;
  command: string | null;
  lines: JobLogLine[];
  failed: boolean;
  firstAt: number | null;
  lastAt: number | null;
  /** Inside the group preamble: the `with:`/`env:` echo, which is not output. */
  inPreamble: boolean;
}

function draft(title: string): SectionDraft {
  return {
    title,
    command: title.startsWith("Run ") ? title.slice(4).trim() : null,
    lines: [],
    failed: false,
    firstAt: null,
    lastAt: null,
    inPreamble: false,
  };
}

function severityOf(text: string): JobLogSeverity {
  if (text.startsWith("##[error]")) return "error";
  if (text.startsWith("##[warning]")) return "warning";
  return "plain";
}

/** The markers have done their job once the severity is read. */
function stripMarkers(text: string): string {
  return text.replace(/^##\[(error|warning|notice|command|debug)\]/, "");
}

function finish(section: SectionDraft): JobLogSection {
  const durationSeconds =
    section.firstAt !== null && section.lastAt !== null
      ? Math.max(0, Math.round((section.lastAt - section.firstAt) / 1000))
      : null;

  return {
    title: section.title,
    command: section.command,
    // Trailing blank lines are how a step ends, not something to render.
    lines: trimBlankEdges(section.lines),
    failed: section.failed,
    durationSeconds,
  };
}

function trimBlankEdges(lines: JobLogLine[]): JobLogLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].text.trim() === "") start += 1;
  while (end > start && lines[end - 1].text.trim() === "") end -= 1;
  return lines.slice(start, end);
}

/**
 * Cuts a raw job log into its steps.
 *
 * Returns an empty array for a log with nothing in it, which the caller shows
 * as the raw blob rather than as "no steps": an unparsed log is still evidence,
 * and a format we failed to recognise must not look like a job that did
 * nothing.
 */
/** One log line, with the timestamp and colour taken off. */
function readLine(rawLine: string): { at: number; body: string } {
  const clean = rawLine.replace(ANSI, "");
  const stamp = TIMESTAMP.exec(clean);

  return {
    at: stamp ? Date.parse(stamp[1]) : NaN,
    body: stamp ? clean.slice(stamp[0].length) : clean,
  };
}

function stamp(section: SectionDraft, at: number): void {
  if (Number.isNaN(at)) return;
  section.firstAt ??= at;
  section.lastAt = at;
}

function openGroup(body: string, at: number): SectionDraft {
  const section = draft(body.slice(GROUP_START.length).trim());
  section.inPreamble = true;
  stamp(section, at);
  return section;
}

function appendLine(section: SectionDraft, body: string): void {
  const severity = severityOf(body);
  const exit = EXIT_CODE.exec(body);
  if (severity === "error" || (exit && exit[1] !== "0")) {
    section.failed = true;
  }

  section.lines.push({ text: stripMarkers(body), severity });
}

export function parseJobLog(raw: string): JobLogSection[] {
  const sections: JobLogSection[] = [];
  // Output before the first group: the runner's own set-up chatter. Kept,
  // because when a job dies there it is the only thing that explains why.
  let current = draft("Job start");

  for (const rawLine of raw.split(/\r?\n/)) {
    const { at, body } = readLine(rawLine);
    stamp(current, at);

    if (body.startsWith(GROUP_START)) {
      if (current.lines.length > 0) sections.push(finish(current));
      current = openGroup(body, at);
      continue;
    }

    if (body.startsWith(GROUP_END)) {
      current.inPreamble = false;
      continue;
    }

    // The `with:`/`env:` echo GitHub prints inside the group header says what
    // the step was configured with, never what it produced.
    if (!current.inPreamble) appendLine(current, body);
  }

  if (current.lines.length > 0) sections.push(finish(current));

  return sections.filter((section) => section.lines.length > 0);
}
