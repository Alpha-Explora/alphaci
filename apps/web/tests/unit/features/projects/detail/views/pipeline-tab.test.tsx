import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PipelineTab } from "../../../../../../src/features/projects/detail/views/pipeline-tab";
import type { PipelineView } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

/* The two views are covered where they live (project-env-panel: runs and the
 * workflow settings); here they are stand-ins, so these tests are about the
 * tab's own row: the heading, the toggle and which view it shows. */
jest.mock("../../../../../../src/features/projects/detail/views/runs-tab", () => ({
  RunsTab: () => <p data-view="runs">runs list</p>,
}));
jest.mock("../../../../../../src/features/projects/detail/views/workflow-tab", () => ({
  WorkflowTab: () => <p data-view="configuration">workflow settings</p>,
}));

const PROJECT = { id: "p1", repoFullName: "Org/shop-fe" } as unknown as ProvisionedProject;

let root: Root | null = null;
const selected: PipelineView[] = [];

/** The tab with the VM's view state, so a click or a key really switches the view. */
function Harness({ initial, available }: Readonly<{ initial: PipelineView; available: boolean }>) {
  const [view, setView] = useState<PipelineView>(initial);
  const vm = {
    pipelineView: view,
    pipelineConfigurationAvailable: available,
    setPipelineView: (next: PipelineView) => {
      selected.push(next);
      setView(next);
    },
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

function toggleTabs(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tablist"][aria-label="Pipeline views"] [role="tab"]')];
}

function shownView(container: HTMLElement): string | null {
  return container.querySelector("[data-view]")?.getAttribute("data-view") ?? null;
}

function press(target: HTMLElement, key: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  selected.length = 0;
  document.body.innerHTML = "";
});

describe("PipelineTab", () => {
  it("opens on Runs under one slim row: the view's name and the Runs | Configuration toggle", () => {
    const container = render();
    const panel = container.querySelector("#project-detail-panel-pipeline")!;
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe("project-detail-tab-pipeline");
    expect(container.querySelector(".pipeline-tab__head h2")?.textContent).toBe("Runs");
    const tabs = toggleTabs(container);
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Runs", "Configuration"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1]);
    expect(shownView(container)).toBe("runs");
    // The view is the toggle's panel, labelled by the selected toggle tab.
    const view = container.querySelector("#project-detail-pipeline-view")!;
    expect(view.getAttribute("role")).toBe("tabpanel");
    expect(view.getAttribute("aria-labelledby")).toBe(tabs[0].id);
    expect(tabs[1].getAttribute("aria-controls")).toBe("project-detail-pipeline-view");
  });

  it("shows the workflow configuration when Configuration is chosen, and Runs again after", () => {
    const container = render();
    act(() => toggleTabs(container)[1].click());
    expect(selected).toEqual(["configuration"]);
    expect(shownView(container)).toBe("configuration");
    expect(container.querySelector(".pipeline-tab__head h2")?.textContent).toBe("Configuration");
    expect(toggleTabs(container).map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    act(() => toggleTabs(container)[0].click());
    expect(shownView(container)).toBe("runs");
  });

  it("opens on Configuration when the VM says so (a #workflow link)", () => {
    const container = render("configuration");
    expect(shownView(container)).toBe("configuration");
    expect(toggleTabs(container)[1].tabIndex).toBe(0);
  });

  it("has no toggle where Configuration is not offered, only Runs", () => {
    const container = render("runs", false);
    expect(toggleTabs(container)).toHaveLength(0);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector(".pipeline-tab__head h2")?.textContent).toBe("Runs");
    expect(container.querySelector("#project-detail-pipeline-view")?.getAttribute("role")).toBeNull();
    expect(shownView(container)).toBe("runs");
  });

  it("moves between the views with the arrow keys, Home and End, focus following", () => {
    const container = render();
    const [runs] = toggleTabs(container);
    runs.focus();
    press(runs, "ArrowRight");
    expect(shownView(container)).toBe("configuration");
    expect(document.activeElement).toBe(toggleTabs(container)[1]);
    press(toggleTabs(container)[1], "ArrowRight");
    expect(shownView(container)).toBe("runs");
    expect(document.activeElement).toBe(toggleTabs(container)[0]);
    press(toggleTabs(container)[0], "End");
    expect(shownView(container)).toBe("configuration");
    press(toggleTabs(container)[1], "Home");
    expect(shownView(container)).toBe("runs");
    press(toggleTabs(container)[0], "ArrowLeft");
    expect(shownView(container)).toBe("configuration");
    // Any other key leaves the view alone.
    press(toggleTabs(container)[1], "Enter");
    expect(shownView(container)).toBe("configuration");
    expect(selected).toEqual(["configuration", "runs", "configuration", "runs", "configuration"]);
  });
});
