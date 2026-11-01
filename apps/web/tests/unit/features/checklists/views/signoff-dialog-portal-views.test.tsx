import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), setVerification: jest.fn(), signoff: jest.fn(), reopen: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/qa-attachments-repository", () => ({
  qaAttachmentsRepository: { listForRun: jest.fn().mockResolvedValue([]), listForItem: jest.fn(), upload: jest.fn(), remove: jest.fn() },
}));

const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function Harness() {
  const vm = useProjectRunViewModel({ deliveryProjectId: "dp-1", enabled: true });
  return <ProjectRunPanel deliveryProjectId="dp-1" vm={vm} appRole="qa" summaryShown={false} />;
}

describe("Sign off from the QA checklist panel", () => {
  it("opens the dialog in <body>, outside the panel that would cut it to its width", async () => {
    runs.current.mockResolvedValue(
      normalizeProjectRunCurrent({ run: projectRunWire({ items: [runItemWire({ status: "passed" })] }), heads: [] }),
    );
    // Stands in for the resizable rail: a narrow box that clips what overflows it.
    const panel = document.createElement("div");
    panel.style.width = "320px";
    panel.style.overflow = "hidden";
    document.body.appendChild(panel);
    root = createRoot(panel);
    await act(async () => root!.render(<Harness />));
    await flush();

    const signOff = [...panel.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Sign off");
    expect(signOff).toBeDefined();
    await act(async () => signOff!.click());

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Sign off this run");
    expect(panel.contains(dialog)).toBe(false);
  });
});
