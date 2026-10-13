import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { RunPipeline } from "../../../../../src/features/runs/list/views/run-pipeline";
import type { RunGroup, StageReport, StageResults } from "../../../../../src/shared/api/contracts";

const ESC = String.fromCharCode(27);

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

function stage(id: StageReport["stage"], status: StageReport["status"], extra: Partial<StageReport> = {}): StageReport {
  return {
    stage: id,
    status,
    runId: 11,
    friendlyMessages: [],
    githubRunUrl: "https://github.com/acme/web/actions/runs/11",
    updatedAt: "2026-10-13T10:00:00Z",
    ...extra,
  };
}

function runWith(failing: StageReport): RunGroup {
  const stages = (["access", "quality", "package", "verify"] as const).map((id) =>
    id === failing.stage ? failing : stage(id, id === "access" ? "success" : "blocked"),
  );
  return {
    runId: 11,
    repoFullName: "acme/web",
    branch: "uat",
    commitSha: "abcdef1234567",
    startedAt: "2026-10-13T10:00:00Z",
    overallStatus: "failure",
    stages,
  } as RunGroup;
}

const SONAR: StageResults["sonar"] = {
  gate: "ERROR",
  failedConditions: [{ metric: "new_coverage", actual: "61.2", threshold: "80" }],
  measures: { bugs: "0", coverage: "74.1" },
};

const TESTS = {
  total: 2,
  passed: 1,
  failed: 1,
  cases: [
    { title: "home.e2e-spec.ts > loads the home page", status: "passed" },
    {
      title: "home.e2e-spec.ts > shows the cart",
      status: "failed",
      error: { message: `${ESC}[2mexpect(${ESC}[22mlocator${ESC}[2m).toBeVisible()${ESC}[22m failed` },
    },
  ],
} as unknown as StageResults["tests"];

describe("/runs run detail", () => {
  it("shows the SonarCloud panel for a failed Quality stage", () => {
    const view = render(
      <RunPipeline
        run={runWith(
          stage("quality", "failure", {
            friendlyMessages: [{ severity: "error", title: "Quality gate failed", detail: "Coverage on new code", hint: "" }],
            results: { sonar: SONAR },
          }),
        )}
        reduced
      />,
    );
    const sonar = view.querySelector(".tr-sonar");
    expect(sonar).not.toBeNull();
    expect(sonar?.textContent).toContain("SonarCloud");
    expect(sonar?.textContent).toContain("Coverage on new code");
  });

  it("lists every browser test of a failed Verify stage, without terminal colour codes", () => {
    const view = render(
      <RunPipeline
        run={runWith(
          stage("verify", "failure", {
            friendlyMessages: [{ severity: "error", title: `${ESC}[31m1 browser test failed${ESC}[39m`, detail: "", hint: "" }],
            results: { tests: TESTS },
          }),
        )}
        reduced
      />,
    );
    const rows = [...view.querySelectorAll(".tr-case")];
    expect(rows).toHaveLength(2);
    expect(view.querySelector(".tr-cases h6")?.textContent).toContain("2 tests");
    expect(view.querySelector(".tr-case__error")?.textContent).toBe("expect(locator).toBeVisible() failed");
    expect(view.textContent).toContain("1 browser test failed");
    expect(view.textContent).not.toContain(ESC);
  });

  it("adds no test or Sonar section when the stage reported neither", () => {
    const view = render(<RunPipeline run={runWith(stage("package", "failure"))} reduced />);
    expect(view.querySelector(".tr-cases")).toBeNull();
    expect(view.querySelector(".tr-sonar")).toBeNull();
  });
});
