import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { JobLogView } from "../../src/features/projects/detail/views/workspace/job-log-view";

const LOG = [
  "2026-09-22T14:00:00.0000000Z ##[group]Run npm ci",
  "2026-09-22T14:00:00.5000000Z ##[endgroup]",
  "2026-09-22T14:02:10.0000000Z added 402 packages",
  "2026-09-22T14:02:20.0000000Z ##[group]Run npm run lint",
  "2026-09-22T14:02:20.5000000Z ##[endgroup]",
  "2026-09-22T14:02:31.0000000Z ✖ 15 problems (3 errors, 12 warnings)",
  "2026-09-22T14:02:31.5000000Z ##[error]Process completed with exit code 1.",
].join("\n");

describe("JobLogView", () => {
  let root: Root | null = null;
  let container: HTMLElement;

  function render(content: string, truncated = false) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<JobLogView content={content} truncated={truncated} />));
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  it("states each tool's own result", () => {
    render(LOG);
    const rows = Array.from(container.querySelectorAll(".ws-toolsum__row"));

    expect(rows.map((row) => row.textContent)).toEqual([
      "✓Run npm ci",
      "✗Format & style (ESLint)3 errors, 12 warnings",
    ]);
  });

  it("opens the failed step and leaves the green one shut", () => {
    // The whole point: the output that explains the failure is on screen
    // without a click, and the 400 lines that do not are one click away.
    render(LOG);
    const open = Array.from(
      container.querySelectorAll<HTMLDetailsElement>("details"),
    ).map((details) => details.open);

    expect(open).toEqual([false, true]);
  });

  it("marks the line that failed the step", () => {
    render(LOG);
    const errors = container.querySelectorAll(".ws-console__line--error");

    expect(errors).toHaveLength(1);
    expect(errors[0].textContent).toContain("exit code 1");
  });

  it("times each step in minutes once it runs past one", () => {
    // A step ends where the next one starts, so `npm ci` is 2m 20s rather
    // than the 2m 10s its last line was written at.
    render(LOG);
    const times = Array.from(
      container.querySelectorAll(".ws-joblog__time"),
    ).map((node) => node.textContent);

    expect(times).toEqual(["2m 20s", "12s"]);
  });

  it("keeps a log with no steps in it as one section", () => {
    // A format we did not recognise is still evidence, and reads better as a
    // section than as a bare blob.
    render("something entirely unlike a GitHub log");

    expect(container.querySelectorAll("details")).toHaveLength(1);
    expect(container.querySelector(".ws-console")!.textContent).toContain(
      "something entirely unlike",
    );
  });

  it("falls back to the raw blob when there is nothing to parse", () => {
    render("   ");

    expect(container.querySelector(".ws-joblog")).toBeNull();
    expect(container.querySelector(".ws-console")).not.toBeNull();
  });

  it("says when the log was cut short", () => {
    render(LOG, true);

    expect(container.textContent).toContain("the first steps may be missing");
  });
});
