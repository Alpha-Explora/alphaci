import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SideTabs, type SideTabGroup } from "../../src/components/hierarchy/side-tabs";

type Section = "overview" | "members" | "projects";

const GROUPS: SideTabGroup<Section>[] = [
  { heading: "Team", items: [{ id: "overview", label: "Overview" }] },
  { heading: "People", items: [{ id: "members", label: "Members", badge: 3 }] },
  { heading: "Work", items: [{ id: "projects", label: "Repositories" }] },
];

function Harness() {
  const [value, setValue] = useState<Section>("overview");
  return (
    <SideTabs
      groups={GROUPS}
      value={value}
      onChange={setValue}
      label="Team sections"
      idPrefix="group"
    />
  );
}

describe("SideTabs", () => {
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

  it("declares a vertical orientation", () => {
    // The tabs pattern binds arrows to the visual axis, so a vertical list
    // must say so or it announces one thing and does another.
    expect(
      container.querySelector('[role="tablist"]')!.getAttribute("aria-orientation"),
    ).toBe("vertical");
  });

  it("hides group headings from the accessibility tree", () => {
    // A tablist may only own tabs, so the headings are presentational.
    const headings = Array.from(
      container.querySelectorAll<HTMLElement>(".side-tabs-heading"),
    );
    expect(headings).toHaveLength(3);
    expect(headings.every((h) => h.getAttribute("role") === "presentation")).toBe(true);
  });

  it("keeps only the selected tab in the Tab order", () => {
    const order = tabs().map((tab) => tab.getAttribute("tabindex"));
    expect(order).toEqual(["0", "-1", "-1"]);
  });

  it("moves down and up with the arrow keys", () => {
    press("ArrowDown");
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    press("ArrowUp");
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("wraps rather than dead-ending at either edge", () => {
    press("ArrowUp");
    expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
    press("ArrowDown");
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
    // ring is over the flattened list rather than per-group.
    press("ArrowDown");
    press("ArrowDown");
    expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
  });

  it("wires each tab to its panel", () => {
    const first = tabs()[0];
    expect(first.id).toBe("group-tab-overview");
    expect(first.getAttribute("aria-controls")).toBe("group-panel-overview");
  });

  it("renders a badge when one is given", () => {
    expect(container.querySelector(".side-tab-badge")!.textContent).toBe("3");
  });
});
