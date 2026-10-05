import { failedTests, stageResultFigures } from "@/features/projects/detail/model/stage-result-figures";
import type { StageResults } from "@/shared/api/contracts";

function read(results: StageResults | undefined) {
  return stageResultFigures(results).map((figure) => `${figure.label}: ${figure.value} [${figure.tone}]`);
}

describe("stageResultFigures", () => {
  it("reads a clean stage's numbers", () => {
    expect(
      read({
        tests: { passed: 48, failed: 0, total: 48 },
        coverage: { pct: 87, threshold: 80 },
        lint: { errors: 0, warnings: 3 },
        security: { critical: 0, high: 0 },
        sonar: { gate: "OK" },
      }),
    ).toEqual([
      "Tests: 48 / 48 passed [success]",
      "Coverage: 87% (min 80%) [success]",
      "Lint: 0 errors · 3 warnings [warning]",
      "Security: 0 critical · 0 high [success]",
      "Sonar: Gate passed [success]",
    ]);
  });

  it("tones what failed", () => {
    expect(
      read({
        tests: { passed: 40, failed: 2, total: 42 },
        coverage: { pct: 61.04, threshold: 80 },
        lint: { errors: 1, warnings: 1 },
        security: { critical: 1, high: 0 },
        sonar: { gate: "ERROR" },
      }),
    ).toEqual([
      "Tests: 40 / 42 passed [danger]",
      "Coverage: 61% (min 80%) [danger]",
      "Lint: 1 error · 1 warning [danger]",
      "Security: 1 critical · 0 high [danger]",
      "Sonar: Gate failed [danger]",
    ]);
  });

  it("does not call an unread or blocked Sonar gate a pass", () => {
    expect(read({ sonar: { gate: "UNKNOWN" } })).toEqual(["Sonar: Gate not read [warning]"]);
    expect(read({ sonar: { gate: "OK", blockedBy: "automatic-analysis" } })).toEqual([
      "Sonar: Analysis blocked [warning]",
    ]);
    expect(read({ sonar: { measures: { coverage: "80" } } })).toEqual([]);
  });

  it("leaves out a coverage threshold of zero, and anything that is not a number", () => {
    expect(read({ coverage: { pct: 55, threshold: 0 } })).toEqual(["Coverage: 55% [success]"]);
    expect(read({ tests: { passed: "x", total: 3 } } as unknown as StageResults)).toEqual([]);
    expect(read(undefined)).toEqual([]);
    expect(read({})).toEqual([]);
  });
});

describe("failedTests", () => {
  it("names the failures and counts the ones the workflow capped", () => {
    const { failures, more } = failedTests({
      tests: { passed: 1, failed: 4, total: 5, failures: [{ name: "a", message: "m" }, { name: "" }, { name: "b" }] },
    });

    expect(failures).toEqual([{ name: "a", message: "m" }, { name: "b" }]);
    expect(more).toBe(2);
  });

  it("is empty without tests", () => {
    expect(failedTests(undefined)).toEqual({ failures: [], more: 0 });
    expect(failedTests({ tests: { passed: 3, failed: 0, total: 3 } })).toEqual({ failures: [], more: 0 });
  });
});
