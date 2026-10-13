import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { AutomationStages } from "../../../../../src/features/checklists/studio/views/automation-panel";
import { normalizeRunAutomation } from "../../../../../src/features/checklists/model/qa-automation-rules";

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

describe("QA Studio stage cards say why", () => {
  it("shows a failed Verify stage's first error instead of 'No test counts reported'", () => {
    const automation = normalizeRunAutomation({
      verify: {
        status: "failure",
        friendlyMessages: [
          { severity: "info", title: "Suite started" },
          { severity: "error", title: `${ESC}[31mThe preview URL answered 404${ESC}[39m` },
        ],
      },
      quality: { status: "success", tests: { total: 3, passed: 3, failed: 0 } },
    });
    const view = render(<AutomationStages automation={automation} commitSha="abcdef1234567" />);
    const reason = view.querySelector(".qa-auto-stage__reason");
    expect(reason?.textContent).toBe("The preview URL answered 404");
    expect(view.textContent).not.toContain("No test counts reported");
    expect(view.textContent).not.toContain(ESC);
  });

  it("keeps 'No test counts reported' for a failed stage that said nothing", () => {
    const automation = normalizeRunAutomation({ verify: { status: "failure" }, quality: null });
    const view = render(<AutomationStages automation={automation} commitSha="abcdef1234567" />);
    expect(view.querySelector(".qa-auto-stage__reason")).toBeNull();
    expect(view.textContent).toContain("No test counts reported");
  });

  it("says Verify did not run because Quality failed first, even when only Verify is shown", () => {
    const automation = normalizeRunAutomation({
      verify: null,
      quality: { status: "failure", friendlyMessages: [{ severity: "error", title: "2 unit tests failed" }] },
    });
    const view = render(<AutomationStages automation={automation} commitSha="abcdef1234567" stages={["verify"]} />);
    expect(view.querySelector(".qa-auto-stage--missing")?.textContent).toContain(
      "Not run: Quality failed on abcdef1 first (2 unit tests failed)",
    );
  });

  it("keeps 'Not reported yet' for a Verify stage with nothing upstream to blame", () => {
    const automation = normalizeRunAutomation({ verify: null, quality: { status: "success" } });
    const view = render(<AutomationStages automation={automation} commitSha="abcdef1234567" />);
    expect(view.querySelector(".qa-auto-stage--missing")?.textContent).toContain("Not reported for abcdef1 yet");
  });
});
