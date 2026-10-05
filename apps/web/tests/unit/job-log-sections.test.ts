import { parseJobLog } from "../../src/features/runs/model/job-log-sections";

/**
 * A real job log's shape: an ISO timestamp on every line, `##[group]` per
 * step, a `with:`/`env:` echo inside the group header, ANSI colour, and
 * `##[error]` on the line that matters.
 */
const LOG = [
  "2026-09-22T14:59:31.1234567Z ##[group]Run actions/checkout@v4",
  "2026-09-22T14:59:31.2000000Z with:",
  "2026-09-22T14:59:31.3000000Z   fetch-depth: 0",
  "2026-09-22T14:59:31.4000000Z ##[endgroup]",
  "2026-09-22T14:59:33.0000000Z Syncing repository: Alphaexplora-Sandbox/demo-fe",
  "2026-09-22T14:59:40.0000000Z ##[group]Run npm run lint",
  "2026-09-22T14:59:40.1000000Z ##[endgroup]",
  "2026-09-22T14:59:52.0000000Z \u001B[31m/src/app.ts\u001B[39m",
  "2026-09-22T14:59:52.1000000Z   14:7  error  'x' is defined but never used",
  "2026-09-22T14:59:53.0000000Z ✖ 15 problems (3 errors, 12 warnings)",
  "2026-09-22T14:59:53.5000000Z ##[error]Process completed with exit code 1.",
].join("\n");

describe("parseJobLog", () => {
  const sections = parseJobLog(LOG);

  it("cuts the log into one section per step", () => {
    expect(sections.map((section) => section.title)).toEqual([
      "Run actions/checkout@v4",
      "Run npm run lint",
    ]);
  });

  it("strips the timestamp every line carries", () => {
    expect(sections[0].lines[0].text).toBe(
      "Syncing repository: Alphaexplora-Sandbox/demo-fe",
    );
  });

  it("strips ANSI colour, which is noise outside a terminal", () => {
    expect(sections[1].lines[0].text).toBe("/src/app.ts");
  });

  it("drops the with:/env: echo inside the group header", () => {
    // It says how the step was configured, never what it produced.
    const text = sections[0].lines.map((line) => line.text).join("\n");
    expect(text).not.toContain("fetch-depth");
    expect(text).not.toContain("with:");
  });

  it("names the command a step ran", () => {
    expect(sections[1].command).toBe("npm run lint");
    expect(sections[0].command).toBe("actions/checkout@v4");
  });

  it("marks the failed step and the line that failed it", () => {
    expect(sections[1].failed).toBe(true);
    expect(sections[0].failed).toBe(false);

    const last = sections[1].lines[sections[1].lines.length - 1];
    expect(last.severity).toBe("error");
    // The marker has done its job once the severity is read.
    expect(last.text).toBe("Process completed with exit code 1.");
  });

  it("ends a failed step at its error, not in the runner's post-job cleanup", () => {
    // The tail of a real promotion job (logistics2cicd-fe run 37030220083):
    // the cleanup follows the last step with no group of its own.
    const tail = [
      "2026-10-02T15:54:10.0000000Z ##[group]Run retry() {",
      "2026-10-02T15:54:10.0000000Z retry() {",
      "2026-10-02T15:54:10.0000000Z ##[endgroup]",
      "2026-10-02T15:54:11.0000000Z GraphQL: Your token has not been granted the required scopes to execute this query.",
      "2026-10-02T15:54:12.0000000Z ##[error]Process completed with exit code 1.",
      "2026-10-02T15:54:13.0000000Z Post job cleanup.",
      "2026-10-02T15:54:13.0000000Z [command]/usr/bin/git version",
      "2026-10-02T15:54:14.0000000Z Cleaning up orphan processes",
    ].join("\n");
    const parsed = parseJobLog(tail);

    expect(parsed.map((section) => section.title)).toEqual(["Run retry() {", "Post job cleanup"]);
    const step = parsed[0];
    expect(step.failed).toBe(true);
    expect(step.lines.map((line) => line.text)).toEqual([
      "GraphQL: Your token has not been granted the required scopes to execute this query.",
      "Process completed with exit code 1.",
    ]);
    expect(parsed[1].failed).toBe(false);
  });

  it("times each step from its own first and last line", () => {
    expect(sections[1].durationSeconds).toBe(14);
  });

  it("fails a step on a non-zero exit code alone", () => {
    const withoutMarker = parseJobLog(
      [
        "2026-09-22T14:00:00.0000000Z ##[group]Run npm test",
        "2026-09-22T14:00:01.0000000Z ##[endgroup]",
        "2026-09-22T14:00:02.0000000Z Process completed with exit code 2.",
      ].join("\n"),
    );

    expect(withoutMarker[0].failed).toBe(true);
  });

  it("keeps a zero exit code green", () => {
    const clean = parseJobLog(
      [
        "2026-09-22T14:00:00.0000000Z ##[group]Run npm test",
        "2026-09-22T14:00:01.0000000Z ##[endgroup]",
        "2026-09-22T14:00:02.0000000Z Process completed with exit code 0.",
      ].join("\n"),
    );

    expect(clean[0].failed).toBe(false);
  });

  it("keeps output written before the first step", () => {
    // When a job dies in the runner's own set-up this is the only evidence.
    const early = parseJobLog(
      [
        "2026-09-22T14:00:00.0000000Z Runner name: gh-runner-3",
        "2026-09-22T14:00:01.0000000Z ##[group]Run npm ci",
        "2026-09-22T14:00:02.0000000Z ##[endgroup]",
        "2026-09-22T14:00:03.0000000Z added 402 packages",
      ].join("\n"),
    );

    expect(early[0].title).toBe("Job start");
    expect(early[0].lines[0].text).toBe("Runner name: gh-runner-3");
  });

  it("marks a warning without calling it a failure", () => {
    const warned = parseJobLog(
      [
        "2026-09-22T14:00:01.0000000Z ##[group]Run npm audit",
        "2026-09-22T14:00:02.0000000Z ##[endgroup]",
        "2026-09-22T14:00:03.0000000Z ##[warning]1 moderate severity vulnerability",
      ].join("\n"),
    );

    expect(warned[0].lines[0].severity).toBe("warning");
    expect(warned[0].lines[0].text).toBe("1 moderate severity vulnerability");
    expect(warned[0].failed).toBe(false);
  });

  it("returns nothing for a log with nothing in it", () => {
    // The caller shows the raw blob instead: a format we failed to recognise
    // is still evidence, and must not read as a job that did nothing.
    expect(parseJobLog("")).toEqual([]);
    expect(parseJobLog("   \n  \n")).toEqual([]);
  });

  it("reads a log with no timestamps at all", () => {
    const plain = parseJobLog(
      ["##[group]Run npm test", "##[endgroup]", "All tests passed"].join("\n"),
    );

    expect(plain[0].lines[0].text).toBe("All tests passed");
    expect(plain[0].durationSeconds).toBeNull();
  });
});
