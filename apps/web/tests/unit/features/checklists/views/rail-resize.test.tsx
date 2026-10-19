import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  clampRailWidth,
  parseRailWidth,
  railWidthMax,
  RAIL_WIDTH_MIN,
  studioRailWidthKey,
} from "../../../../../src/features/checklists/model/qa-studio-rules";
import { RailResizeHandle } from "../../../../../src/features/checklists/studio/views/rail-resize-handle";
import {
  useRailWidth,
  type RailWidthViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-rail-width";

describe("the rail's width rules", () => {
  it("keeps a width between the minimum and what leaves the page a strip", () => {
    expect(railWidthMax(1400)).toBe(1160);
    expect(railWidthMax(300)).toBe(RAIL_WIDTH_MIN);
    expect(clampRailWidth(200, 1160)).toBe(RAIL_WIDTH_MIN);
    expect(clampRailWidth(2000, 1160)).toBe(1160);
    expect(clampRailWidth(640.4, 1160)).toBe(640);
  });

  it("reads a remembered width, and anything unusable as the default", () => {
    expect(parseRailWidth("720")).toBe(720);
    expect(parseRailWidth(null)).toBeNull();
    expect(parseRailWidth("")).toBeNull();
    expect(parseRailWidth("wide")).toBeNull();
    expect(parseRailWidth("100")).toBeNull();
    expect(studioRailWidthKey("qa")).toBe("alphaci.qa-studio.rail-width");
  });
});

describe("dragging the panel's left edge", () => {
  let root: Root | null = null;
  const latest: { vm: RailWidthViewModel | null } = { vm: null };

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    latest.vm = null;
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  function mount() {
    const keep = (vm: RailWidthViewModel) => {
      latest.vm = vm;
    };
    function Harness({ onVm }: { onVm: (vm: RailWidthViewModel) => void }) {
      const vm = useRailWidth("qa");
      onVm(vm);
      return (
        <div className="qa-studio" style={vm.style} data-resizing={String(vm.resizing)}>
          <div className="qa-studio__panes">
            <div className="qa-rail">
              <RailResizeHandle vm={vm} label="QA checklist" />
            </div>
          </div>
        </div>
      );
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Harness onVm={keep} />));
    const panes = container.querySelector(".qa-studio__panes") as HTMLElement;
    Object.defineProperty(panes, "clientWidth", { configurable: true, value: 1400 });
    return { container, handle: container.querySelector('[role="separator"]') as HTMLElement };
  }

  function pointer(element: HTMLElement, type: string, clientX: number) {
    act(() => {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX }));
    });
  }

  it("widens the panel as the edge moves towards the page, and remembers it", () => {
    const { container, handle } = mount();
    expect(handle.getAttribute("aria-label")).toBe("Resize QA checklist");
    expect(latest.vm?.width).toBeNull();

    pointer(handle, "pointerdown", 1000);
    expect(latest.vm?.resizing).toBe(true);
    pointer(handle, "pointermove", 800);
    expect(latest.vm?.width).toBe(680);
    expect((container.querySelector(".qa-studio") as HTMLElement).style.getPropertyValue("--qa-rail-width")).toBe("680px");
    pointer(handle, "pointerup", 760);

    expect(latest.vm?.resizing).toBe(false);
    expect(latest.vm?.width).toBe(720);
    expect(window.localStorage.getItem("alphaci.qa-studio.rail-width")).toBe("720");
  });

  it("never goes past the page's strip or below the minimum", () => {
    const { handle } = mount();
    pointer(handle, "pointerdown", 1000);
    pointer(handle, "pointermove", -2000);
    expect(latest.vm?.width).toBe(1160);
    pointer(handle, "pointermove", 1900);
    expect(latest.vm?.width).toBe(RAIL_WIDTH_MIN);
  });

  it("moves in steps with the arrow keys, and a double-click goes back to the default", () => {
    const { handle } = mount();
    act(() => handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(latest.vm?.width).toBe(512);
    act(() => handle.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect(latest.vm?.width).toBe(1160);
    act(() => handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(latest.vm?.width).toBeNull();
    expect(latest.vm?.style).toBeUndefined();
  });
});
