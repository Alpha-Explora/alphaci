import {
  runStatusColors,
  stageStatusColors,
  severityColors,
  relativeTime,
  shortSha,
  stageLabel,
  checkTone,
  checkLabel,
} from "../../../../../src/features/runs/model/runs-presentation";

describe("runStatusColors", () => {
  it("returns green ring for success", () => {
    const c = runStatusColors("success");
    expect(c.ring).toBe("var(--success)");
    expect(c.label).toBe("Passed");
  });

  it("returns danger ring for failure", () => {
    const c = runStatusColors("failure");
    expect(c.ring).toBe("var(--danger)");
    expect(c.label).toBe("Failed");
  });

  it("returns brand ring for running", () => {
    const c = runStatusColors("running");
    expect(c.ring).toBe("var(--brand)");
    expect(c.label).toBe("Running");
  });

  it("returns amber ring for partial", () => {
    const c = runStatusColors("partial");
    expect(c.ring).toBe("var(--accent-amber)");
    expect(c.label).toBe("Partial");
  });

  it("returns muted ring for cancelled", () => {
    const c = runStatusColors("cancelled");
    expect(c.ring).toBe("var(--text-muted)");
    expect(c.label).toBe("Cancelled");
  });
});

describe("stageStatusColors", () => {
  it("returns success colors", () => {
    const c = stageStatusColors("success");
    expect(c.ring).toBe("var(--success)");
  });

  it("returns danger colors for failure", () => {
    const c = stageStatusColors("failure");
    expect(c.ring).toBe("var(--danger)");
  });

  it("returns muted for pending", () => {
    const c = stageStatusColors("pending");
    expect(c.iconColor).toBe("var(--text-muted)");
  });

  it("returns muted for cancelled", () => {
    const c = stageStatusColors("cancelled");
    expect(c.iconColor).toBe("var(--text-muted)");
  });

  it("returns running colors for running", () => {
    const c = stageStatusColors("running");
    expect(c.ring).toBe("var(--brand)");
  });
});

describe("severityColors", () => {
  it("returns danger border for error", () => {
    expect(severityColors("error").border).toBe("var(--danger)");
    expect(severityColors("error").label).toBe("Error");
  });

  it("returns amber border for warning", () => {
    expect(severityColors("warning").border).toBe("var(--accent-amber)");
  });

  it("returns brand border for info", () => {
    expect(severityColors("info").border).toBe("var(--brand)");
  });

  it("returns success border for success", () => {
    expect(severityColors("success").border).toBe("var(--success)");
  });
});

describe("relativeTime", () => {
  function isoAgo(ms: number): string {
    return new Date(Date.now() - ms).toISOString();
  }

  it("returns 'just now' for < 60 seconds", () => {
    expect(relativeTime(isoAgo(30 * 1000))).toBe("just now");
    expect(relativeTime(isoAgo(0))).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(relativeTime(isoAgo(5 * 60 * 1000))).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(relativeTime(isoAgo(3 * 60 * 60 * 1000))).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(relativeTime(isoAgo(2 * 24 * 60 * 60 * 1000))).toBe("2d ago");
  });

  it("returns months ago", () => {
    expect(relativeTime(isoAgo(45 * 24 * 60 * 60 * 1000))).toBe("1mo ago");
  });

  it("returns years ago", () => {
    expect(relativeTime(isoAgo(400 * 24 * 60 * 60 * 1000))).toBe("1y ago");
  });

  it("returns 'just now' for future timestamps", () => {
    const future = new Date(Date.now() + 5000).toISOString();
    expect(relativeTime(future)).toBe("just now");
  });
});

describe("shortSha", () => {
  it("returns first 7 characters", () => {
    expect(shortSha("a1b2c3d4e5f6g7h")).toBe("a1b2c3d");
  });

  it("handles 7-char sha", () => {
    expect(shortSha("abcdefg")).toBe("abcdefg");
  });
});

describe("stageLabel", () => {
  it("maps access", () => {
    expect(stageLabel("access")).toBe("Access");
  });
  it("maps quality", () => {
    expect(stageLabel("quality")).toBe("Quality");
  });
  it("maps package", () => {
    expect(stageLabel("package")).toBe("Package");
  });
});

describe("per-tool check presentation", () => {
  /*
   * The whole reason the per-tool list exists is that a green bar hid what was
   * underneath it. Folding `skipped` into "passed" would rebuild that problem
   * one level down: a tool that never ran would read as a tool that worked.
   */
  it("does not let a skipped tool read as a passing one", () => {
    expect(checkTone("skipped")).toBe("skipped");
    expect(checkTone("skipped")).not.toBe("passed");
  });

  it("treats only an actual success as passed", () => {
    expect(checkTone("success")).toBe("passed");
  });

  it.each(["failure", "timed_out", "action_required"])(
    "treats %s as a failure",
    (conclusion) => {
      expect(checkTone(conclusion)).toBe("failed");
    },
  );

  it.each(["running", "in_progress", "queued"])(
    "treats %s as still running",
    (conclusion) => {
      expect(checkTone(conclusion)).toBe("running");
    },
  );

  /*
   * An unrecognised conclusion is not evidence that anything worked. GitHub can
   * add one, and a build that has never heard of it must not call it green.
   */
  it("refuses to call an unrecognised conclusion passed", () => {
    expect(checkTone("some_future_conclusion")).toBe("skipped");
    expect(checkTone("")).toBe("skipped");
  });

  it("names known job ids after the tool, not the job", () => {
    expect(checkLabel("dotnet-tests")).toBe("Unit tests & coverage");
    expect(checkLabel("sbom")).toBe("SBOM export");
    expect(checkLabel("sonar")).toBe("Code quality & SAST");
  });

  it("still renders a job id it has never seen", () => {
    // A stack this build predates must show its tools, not a blank row.
    expect(checkLabel("mutation-testing")).toBe("Mutation testing");
    expect(checkLabel("k6_load")).toBe("K6 load");
  });
});
