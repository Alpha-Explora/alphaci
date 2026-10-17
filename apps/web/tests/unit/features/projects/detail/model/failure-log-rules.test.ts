import {
  failureEntries,
  failureForJob,
  failurePreview,
  jobLogPendingMessage,
  jobLogReady,
  logUnavailableMessage,
  omittedFailuresLabel,
} from "@/features/projects/detail/model/failure-log-rules";

const ENTRY = { jobId: 9, jobName: "promote-to-uat", lines: ["boom"], truncated: false };

describe("failureEntries", () => {
  it("prefers the full list of failed jobs", () => {
    const entries = failureEntries({
      available: true,
      jobName: "first",
      lines: ["x"],
      failures: [ENTRY, { ...ENTRY, jobId: 10, jobName: "production-gate" }],
    });

    expect(entries.map((entry) => entry.jobName)).toEqual(["promote-to-uat", "production-gate"]);
  });

  it("falls back to the one job an older backend describes", () => {
    const [entry] = failureEntries({ available: true, jobName: "lint", stepName: "Run lint", lines: ["e"], truncated: true });

    expect(entry).toEqual({
      jobId: undefined,
      jobName: "lint",
      stepName: "Run lint",
      lines: ["e"],
      truncated: true,
      hint: undefined,
    });
  });

  it("has nothing to show for an unavailable or empty log", () => {
    expect(failureEntries({ available: false, reason: "log-expired" })).toEqual([]);
    expect(failureEntries({ available: true, lines: [] })).toEqual([]);
    expect(failureEntries({ available: false, reason: "no-failed-job", failures: [] })).toEqual([]);
  });

  it("matches a job row to its entry by id", () => {
    const log = { available: true, failures: [ENTRY] };

    expect(failureForJob(log, 9)?.jobName).toBe("promote-to-uat");
    expect(failureForJob(log, 1)).toBeNull();
    expect(failureForJob(null, 9)).toBeNull();
  });
});

describe("omittedFailuresLabel", () => {
  it("counts the jobs past the cap", () => {
    expect(omittedFailuresLabel({ omittedFailures: 1 })).toBe("+1 more failed job");
    expect(omittedFailuresLabel({ omittedFailures: 3 })).toBe("+3 more failed jobs");
    expect(omittedFailuresLabel({})).toBeNull();
    expect(omittedFailuresLabel({ omittedFailures: 0 })).toBeNull();
  });
});

describe("logUnavailableMessage", () => {
  it("names expiry, access and a run with no failed job differently", () => {
    expect(logUnavailableMessage("log-expired")).toBe("This log has expired (GitHub keeps logs for 90 days).");
    expect(logUnavailableMessage("log-no-access")).toContain("Ask an admin to check the GitHub App's Actions permission.");
    expect(logUnavailableMessage("no-failed-job")).toContain("rejected before any job started");
  });

  it("reads a missing reason from an older backend as expiry", () => {
    expect(logUnavailableMessage(undefined)).toBe(logUnavailableMessage("log-expired"));
  });
});

describe("jobLogReady", () => {
  it("is true only once GitHub reports the job completed", () => {
    expect(jobLogReady("completed")).toBe(true);
    expect(jobLogReady("in_progress")).toBe(false);
    expect(jobLogReady("queued")).toBe(false);
    expect(jobLogReady("waiting")).toBe(false);
  });

  it("says a running or queued job has no log yet, never that access is missing", () => {
    expect(jobLogPendingMessage("in_progress")).toContain("this job is still running");
    expect(jobLogPendingMessage("queued")).toContain("has not started yet");
    expect(jobLogPendingMessage("in_progress")).not.toContain("access");
  });
});

describe("failurePreview", () => {
  it("prefers the tool's own error lines over the runner's exit code", () => {
    expect(
      failurePreview([
        "npm ci",
        "##[error]src/a.ts(3,1): error TS2304: Cannot find name 'x'.",
        "##[error]Process completed with exit code 2.",
      ]),
    ).toEqual(["src/a.ts(3,1): error TS2304: Cannot find name 'x'."]);
  });

  it("keeps at most the last three error lines", () => {
    const lines = ["##[error]one", "##[error]two", "##[error]three", "##[error]four"];

    expect(failurePreview(lines)).toEqual(["two", "three", "four"]);
  });

  it("reads the lines above the exit marker when the tool printed no marker of its own", () => {
    expect(
      failurePreview([
        "Run dotnet sonarscanner end",
        "",
        "sonar-project.properties files are not understood.",
        "Post-processing failed. Exit code: 1",
        "##[error]Process completed with exit code 1.",
      ]),
    ).toEqual([
      "Run dotnet sonarscanner end",
      "sonar-project.properties files are not understood.",
      "Post-processing failed. Exit code: 1",
    ]);
  });

  it("falls back to the tail, then to the marker itself", () => {
    expect(failurePreview(["a", "b", "c", "d"])).toEqual(["b", "c", "d"]);
    expect(failurePreview(["##[error]Process completed with exit code 1."])).toEqual([
      "Process completed with exit code 1.",
    ]);
    expect(failurePreview([])).toEqual([]);
  });
});
