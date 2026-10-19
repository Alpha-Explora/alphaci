import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PipelineTab } from "../../../../../../src/features/projects/detail/views/pipeline-tab";
import type { PipelineView } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

/* The two views are covered where they live; these stand-ins check the
 * Pipeline tab's heading and its view selection from a deep link. */
jest.mock("../../../../../../src/features/projects/detail/views/runs-tab", () => ({
  RunsTab: () => <p data-view="runs">runs list</p>,
}));
jest.mock("../../../../../../src/features/projects/detail/views/workflow-tab", () => ({
  WorkflowTab: () => <p data-view="configuration">workflow settings</p>,
}));

const PROJECT = { id: "p1", repoFullName: "Org/shop-fe" } as unknown as ProvisionedProject;

let root: Root | null = null;

/** The tab with the VM's view state, so a click or a key really switches the view. */
function Harness({ initial, available }: Readonly<{ initial: PipelineView; available: boolean }>) {
  const vm = {
    pipelineView: initial,
    pipelineConfigurationAvailable: available,
  } as unknown as ProjectDetailTabsViewModel;
  return <PipelineTab project={PROJECT} vm={vm} />;
}

function render(initial: PipelineView = "runs", available = true): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Harness initial={initial} available={available} />));
  return container;
}

function shownView(container: HTMLElement): string | null {
  return container.querySelector("[data-view]")?.getAttribute("data-view") ?? null;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("PipelineTab", () => {
  // The runs list draws its own "Workflows" heading beside its branch picker
  // (covered in pipeline-runs-branch-picker.test.tsx), so on the runs view the
  // tab adds no second heading.
  it("opens on the runs list without its own heading, description or view toggle", () => {
    const container = render();
    const panel = container.querySelector("#project-detail-panel-pipeline")!;
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe("project-detail-tab-pipeline");
    expect(container.querySelector(".pipeline-tab__head")).toBeNull();
    expect(container.querySelector(".pipeline-tab__hint")).toBeNull();
    expect(container.querySelector("[role=tablist]")).toBeNull();
    expect(shownView(container)).toBe("runs");
  });

  it("keeps workflow settings available to a #workflow deep link", () => {
    const container = render("configuration");
    expect(shownView(container)).toBe("configuration");
    expect(container.querySelector(".pipeline-tab__head h2")?.textContent).toBe("Workflows");
    expect(container.querySelector("[role=tablist]")).toBeNull();
  });

  it("shows no legacy view controls when Configuration is not offered", () => {
    const container = render("runs", false);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector(".pipeline-tab__head")).toBeNull();
    expect(shownView(container)).toBe("runs");
  });
});
