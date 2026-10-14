import realCases from "./real-playwright-cases.json";

import {
  casesFromPasses,
  durationLabel,
  hasTestDetail,
  noteLabel,
  normalizeTestCases,
  orderTestCases,
  testCaseMeta,
  testCaseName,
  testCaseStatusWord,
  testCaseTone,
  testListHeading,
} from "../../../../../src/features/runs/test-report/model/test-case-rules";
import {
  hasSonarDetail,
  sonarCondition,
  sonarGate,
  sonarIssueWhere,
  sonarMeasures,
  sonarMetricName,
  sonarSeverityLabel,
  sonarValue,
} from "../../../../../src/features/runs/test-report/model/sonar-rules";

/* `realCases` is a real run: the starter pack against the logistics2cicd
 * frontend's uat site, summarised by the central workflow (2026-10-09). */

describe("normalizeTestCases", () => {
  it("reads every real record, with its description, notes, steps and error", () => {
    const cases = normalizeTestCases(realCases)!;
    expect(cases).toHaveLength(6);
    const failed = cases[0]!;
    expect(failed.status).toBe("failed");
    expect(failed.description).toContain("Runs the axe accessibility checker on /");
    expect(failed.notes?.[0]).toEqual({
      type: "result",
      text: "3 critical or serious and 2 minor or moderate violations; 23 accessibility rules passed",
    });
    expect(failed.steps?.map((step) => step.failed)).toEqual([false, false, true]);
    expect(failed.error?.message).toContain("select-name (critical)");
    expect(failed.error?.location).toBe("tests/e2e/a11y.e2e-spec.ts:51");
  });

  it("drops malformed records and is null when the server sent none", () => {
    expect(normalizeTestCases([{ title: "ok", status: "passed" }, { title: "x" }, null, "y"])).toEqual([
      expect.objectContaining({ title: "ok", status: "passed" }),
    ]);
    expect(normalizeTestCases(undefined)).toBeNull();
    expect(normalizeTestCases("nope")).toBeNull();
  });

  it("builds plain passed records from names, for a pipeline without detail", () => {
    expect(casesFromPasses(["a.spec.ts > t"])).toEqual([{ title: "a.spec.ts > t", status: "passed" }]);
    expect(casesFromPasses(undefined)).toEqual([]);
  });
});

describe("test wording", () => {
  const cases = normalizeTestCases(realCases)!;

  it("names a test without its spec file, keeping describe blocks", () => {
    expect(testCaseName(cases[0]!)).toBe("no critical or serious accessibility violations on /");
    expect(testCaseName({ title: "home.e2e-spec.ts > logistics2cicd-frontend deployment > serves its entry page" })).toBe(
      "logistics2cicd-frontend deployment › serves its entry page",
    );
    expect(testCaseName({ title: "just a name" })).toBe("just a name");
  });

  it("puts where, browser, time and retries on one line", () => {
    expect(testCaseMeta(cases[0]!)).toMatch(/^tests\/e2e\/a11y\.e2e-spec\.ts:11 · chromium · \d+(\.\d)? s · 1 retry$/);
    expect(testCaseMeta({ title: "t", status: "passed" })).toBe("");
  });

  it("words statuses and tones them", () => {
    expect(testCaseStatusWord("flaky")).toBe("Passed on retry");
    expect(testCaseTone("failed")).toBe("danger");
    expect(testCaseTone("skipped")).toBe("muted");
  });

  it("formats durations", () => {
    expect(durationLabel(1810)).toBe("1.8 s");
    expect(durationLabel(340)).toBe("340 ms");
    expect(durationLabel(undefined)).toBeNull();
  });

  it("labels notes", () => {
    expect(noteLabel("visual")).toBe("Screenshot");
    expect(noteLabel("result")).toBe("Result");
  });

  it("unfolds only a test with steps or an error", () => {
    expect(hasTestDetail(cases[0]!)).toBe(true);
    expect(hasTestDetail({ title: "t", status: "passed" })).toBe(false);
  });

  it("orders failures first, keeping the run's order otherwise", () => {
    const ordered = orderTestCases([
      { title: "a", status: "passed" },
      { title: "b", status: "skipped" },
      { title: "c", status: "failed" },
      { title: "d", status: "flaky" },
      { title: "e", status: "passed" },
    ]);
    expect(ordered.map((test) => test.title)).toEqual(["c", "d", "a", "e", "b"]);
  });

  it("heads the list with the count and the failures", () => {
    expect(testListHeading(cases, 6)).toBe("6 tests · 1 failed");
    expect(testListHeading(cases.slice(1), 40)).toBe("5 of 40 tests listed");
    expect(testListHeading([{ title: "t", status: "passed" }], null)).toBe("1 test");
  });
});

describe("SonarCloud wording", () => {
  it("names metrics and adds units; ratings read as letters", () => {
    expect(sonarMetricName("new_coverage")).toBe("Coverage on new code");
    expect(sonarMetricName("cognitive_complexity")).toBe("cognitive_complexity");
    expect(sonarValue("coverage", "74.1")).toBe("74.1%");
    expect(sonarValue("bugs", "0")).toBe("0");
    expect(sonarValue("new_security_rating", "1.0")).toBe("A");
    expect(sonarValue("bugs", undefined)).toBe("—");
  });

  it("says a failed condition as a sentence", () => {
    expect(sonarCondition({ metric: "new_coverage", actual: "61.2", threshold: "80" })).toBe(
      "Coverage on new code 61.2% (needs 80%)",
    );
  });

  it("orders measures: counts first, coverage, then duplication, then the rest", () => {
    expect(
      sonarMeasures({ duplicated_lines_density: "1.4", zz_custom: "9", bugs: "0", coverage: "74.1" }).map(
        (measure) => measure.label,
      ),
    ).toEqual(["Bugs", "Coverage", "Duplicated lines", "zz_custom"]);
  });

  it("reads the gate, and explains a blocked analysis", () => {
    expect(sonarGate({ gate: "OK" })).toMatchObject({ label: "Quality gate passed", tone: "success" });
    expect(sonarGate({ gate: "ERROR" })).toMatchObject({ label: "Quality gate failed", tone: "danger" });
    expect(sonarGate({ gate: "UNKNOWN" })).toMatchObject({ label: "Quality gate not read", tone: "muted" });
    expect(sonarGate({ blockedBy: "automatic-analysis" }).blockedReason).toContain("Automatic Analysis is on");
  });

  it("knows when there is nothing to show", () => {
    expect(hasSonarDetail(undefined)).toBe(false);
    expect(hasSonarDetail({})).toBe(false);
    expect(hasSonarDetail({ measures: {} })).toBe(false);
    expect(hasSonarDetail({ issues: [{ rule: "r", message: "m" }] })).toBe(true);
  });

  it("places an issue and words its severity", () => {
    expect(sonarIssueWhere({ file: "src/app.ts", line: 12 })).toBe("src/app.ts:12");
    expect(sonarIssueWhere({ file: "src/app.ts" })).toBe("src/app.ts");
    expect(sonarIssueWhere({})).toBeNull();
    expect(sonarSeverityLabel("MAJOR")).toBe("Major");
  });
});
