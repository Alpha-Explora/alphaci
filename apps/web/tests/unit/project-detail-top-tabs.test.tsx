import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectDetailTopTabs } from "../../src/features/projects/detail/views/project-detail-top-tabs";
import type { SideTabGroup } from "../../src/features/groups/workspace/views/side-tabs";

type Section = "overview" | "runs" | "hosting";

const GROUPS: SideTabGroup<Section>[] = [
  { heading: "Work", items: [{ id: "overview", label: "Overview" }] },
  { heading: "Pipeline", items: [{ id: "runs", label: "Pipeline runs", badge: 2 }] },
  { heading: "Delivery", items: [{ id: "hosting", label: "Hosting" }] },
];

function Harness() {
  const [value, setValue] = useState<Section>("overview");
  return (
    <ProjectDetailTopTabs
      groups={GROUPS}
      value={value}
      onChange={setValue}
      label="Project sections"
      idPrefix="project-detail"
    />
  );
}

describe("ProjectDetailTopTabs", () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Harness />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  function tabs() {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }
  function press(key: string) {
    act(() => {
      container
        .querySelector('[role="tablist"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  }

  it("declares a horizontal orientation", () => {
    // The tabs pattern binds arrows to the visual axis. The rail says
    // vertical and answers Up/Down; a strip must say the opposite of both.
    expect(
      container.querySelector('[role="tablist"]')!.getAttribute("aria-orientation"),
    ).toBe("horizontal");
  });

  it("draws no group headings", () => {
    // The clusters are drawn with a rule between them instead: a heading per
    // group would make the strip two rows tall.
    expect(container.textContent).not.toContain("Delivery");
    expect(container.querySelectorAll(".side-tabs-heading")).toHaveLength(0);
    // The clusters themselves survive; only their labels are gone.
    expect(container.querySelectorAll(".project-tabs__group")).toHaveLength(3);
  });

  it("keeps only the selected tab in the Tab order", () => {
    expect(tabs().map((tab) => tab.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
    ]);
  });

  it("moves right and left with the arrow keys", () => {
    press("ArrowRight");
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    press("ArrowLeft");
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("ignores the rail's up and down keys", () => {
    // Left as a real assertion rather than an omission: answering both axes
    // would make the strip claim an orientation it does not have.
    press("ArrowDown");
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("wraps rather than dead-ending at either edge", () => {
    press("ArrowLeft");
    expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
    press("ArrowRight");
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("jumps to the first and last item with Home and End", () => {
    press("End");
    expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
    press("Home");
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("crosses group boundaries as one ring", () => {
    // Each group holds a single item here, so any movement at all proves the
    // ring is over the flattened list rather than over each group.
    press("ArrowRight");
    press("ArrowRight");
    expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
  });

  it("wires each tab to its panel", () => {
    const first = tabs()[0];
    expect(first.id).toBe("project-detail-tab-overview");
    expect(first.getAttribute("aria-controls")).toBe(
      "project-detail-panel-overview",
    );
  });

  it("renders a badge when one is given", () => {
    expect(container.querySelector(".project-tab__badge")!.textContent).toBe("2");
  });
});
