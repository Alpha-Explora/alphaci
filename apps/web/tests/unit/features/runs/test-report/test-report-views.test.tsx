import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import realCases from "./real-playwright-cases.json";

import { SonarPanel, TestCaseList, normalizeTestCases } from "../../../../../src/features/runs/test-report";

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

const CASES = normalizeTestCases(realCases)!;

describe("TestCaseList on a real run", () => {
  it("lists every test, failures first, under a heading with the count", () => {
    const view = render(<TestCaseList cases={CASES} total={6} />);
    expect(view.querySelector("h6")?.textContent).toBe("Browser tests · 6 tests · 1 failed");
    const rows = [...view.querySelectorAll(".tr-case")];
    expect(rows).toHaveLength(6);
    expect(rows[0]?.getAttribute("data-tone")).toBe("danger");
    expect(rows[0]?.querySelector(".tr-case__name")?.textContent).toBe(
      "no critical or serious accessibility violations on /",
    );
  });

  it("says what each test checks and what it found", () => {
    const view = render(<TestCaseList cases={CASES} total={6} />);
    const text = view.textContent ?? "";
    expect(text).toContain("Runs the axe accessibility checker on / and fails on any critical or serious violation");
    expect(text).toContain("Result 3 critical or serious and 2 minor or moderate violations; 23 accessibility rules passed");
    expect(text).toContain("Result / answered HTTP 200 with 0 console or page errors");
    expect(text).toContain("Result 0 same-site links found, 0 checked, 0 broken");
    expect(text).toContain("Screenshot home-desktop.png: new screenshot, waiting for approval in ALPHACI");
  });

  it("opens a failure on its steps and full error", () => {
    const view = render(<TestCaseList cases={CASES} total={6} />);
    const failed = view.querySelector(".tr-case")!;
    const toggle = failed.querySelector<HTMLButtonElement>(".tr-case__toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("Hide steps and error");
    const detail = failed.querySelector(".tr-case__detail")!;
    expect(toggle.getAttribute("aria-controls")).toBe(detail.id);
    expect([...detail.querySelectorAll(".tr-case__steps li")].map((li) => li.getAttribute("data-failed"))).toEqual([
      null,
      null,
      "true",
    ]);
    expect(detail.querySelector("pre")?.textContent).toContain(
      "label (critical): Form elements must have labels",
    );
    expect(detail.textContent).toContain("at tests/e2e/a11y.e2e-spec.ts:51");
  });

  it("keeps a passing test's steps folded until asked", () => {
    const view = render(<TestCaseList cases={CASES} total={6} />);
    const pages = [...view.querySelectorAll(".tr-case")].find((row) =>
      row.textContent?.includes("loads / without errors"),
    )!;
    const toggle = pages.querySelector<HTMLButtonElement>(".tr-case__toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(pages.querySelector(".tr-case__detail")).toBeNull();
    act(() => toggle.click());
    expect(pages.querySelector(".tr-case__steps")?.textContent).toContain("Check the HTTP status");
  });

  it("offers no toggle for a test with nothing to unfold, and renders nothing for no tests", () => {
    const view = render(<TestCaseList cases={CASES} total={6} />);
    const own = [...view.querySelectorAll(".tr-case")].find((row) =>
      row.textContent?.includes("serves its entry page"),
    )!;
    expect(own.querySelector(".tr-case__toggle")).toBeNull();
    act(() => root?.unmount());
    root = null;
    expect(render(<TestCaseList cases={[]} />).childElementCount).toBe(0);
  });

  it("never shows the runner's absolute path", () => {
    const view = render(<TestCaseList cases={CASES} total={6} />);
    expect(view.textContent).not.toMatch(/[A-Z]:\\Users|\/home\/runner/);
  });

  it("folds behind its heading when foldable, open at first only when a test failed", () => {
    const passing = CASES.filter((test) => test.status !== "failed");
    const view = render(<TestCaseList cases={passing} label="Verify tests" foldable />);
    const toggle = view.querySelector<HTMLButtonElement>("h6 button")!;
    const list = view.querySelector<HTMLElement>(".tr-cases__list")!;
    expect(toggle.textContent).toBe("Verify tests · 5 tests");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(list.id);
    expect(list.hidden).toBe(true);
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(list.hidden).toBe(false);

    act(() => root?.unmount());
    root = null;
    const failing = render(<TestCaseList cases={CASES} total={6} foldable />);
    expect(failing.querySelector("h6 button")?.getAttribute("aria-expanded")).toBe("true");
    expect(failing.querySelector<HTMLElement>(".tr-cases__list")?.hidden).toBe(false);
  });
});

describe("SonarPanel", () => {
  const sonar = {
    gate: "ERROR",
    failedConditions: [{ metric: "new_coverage", actual: "61.2", threshold: "80" }],
    measures: { bugs: "0", vulnerabilities: "0", code_smells: "14", coverage: "74.1", duplicated_lines_density: "1.4" },
    issues: [
      {
        rule: "typescript:S1854",
        severity: "MAJOR",
        message: 'Remove this useless assignment to variable "total".',
        file: "src/cart/total.ts",
        line: 42,
      },
    ],
  };

  it("shows the gate, each failed condition in words, the measures and the issues", () => {
    const view = render(<SonarPanel sonar={sonar} />);
    expect(view.querySelector(".tr-sonar__head")?.textContent).toContain("Quality gate failed");
    expect(view.querySelector(".tr-sonar__conditions")?.textContent).toBe("Coverage on new code 61.2% (needs 80%)");
    const measures = [...view.querySelectorAll(".tr-sonar__measure")].map((node) => node.textContent);
    expect(measures).toEqual(["Bugs0", "Vulnerabilities0", "Code smells14", "Coverage74.1%", "Duplicated lines1.4%"]);
    expect(view.querySelector(".tr-sonar__issue")?.textContent).toBe(
      'Remove this useless assignment to variable "total".Major · src/cart/total.ts:42 · typescript:S1854',
    );
  });

  it("explains a blocked analysis", () => {
    const view = render(<SonarPanel sonar={{ blockedBy: "automatic-analysis" }} />);
    expect(view.textContent).toContain("Analysis blocked");
    expect(view.textContent).toContain("Automatic Analysis is on");
  });

  it("renders nothing when SonarCloud said nothing", () => {
    expect(render(<SonarPanel sonar={undefined} />).childElementCount).toBe(0);
  });
});
