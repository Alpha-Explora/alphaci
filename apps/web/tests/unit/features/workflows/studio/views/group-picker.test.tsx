import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { GroupPicker } from "../../../../../../src/features/workflows/studio/views/group-picker";

const OPTIONS = [
  { id: "g-1", name: "Team Blaine", repositoryCount: 12 },
  { id: "g-2", name: "Johns Kitchen", repositoryCount: 1 },
  { id: "g-3", name: "Platform", repositoryCount: 0 },
];

let root: Root | null = null;
let container: HTMLDivElement;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

function renderPicker(props: Partial<React.ComponentProps<typeof GroupPicker>> = {}) {
  const onSelect = jest.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <GroupPicker
        options={OPTIONS}
        selectedId="g-1"
        label="Team Blaine"
        onSelect={onSelect}
        {...props}
      />,
    );
  });
  return { onSelect };
}

const trigger = () => container.querySelector<HTMLButtonElement>("button[aria-haspopup='listbox']")!;
const search = () => container.querySelector<HTMLInputElement>("input[role='combobox']");
const options = () => Array.from(container.querySelectorAll<HTMLElement>("[role='option']"));

function key(target: Element, keyName: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true }));
  });
}

function type(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function activeOption(): HTMLElement | null {
  const id = search()?.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

describe("GroupPicker", () => {
  it("is the page heading and the current-projects tour anchor", () => {
    renderPicker();
    const heading = container.querySelector("h1");
    expect(heading?.textContent).toContain("Team Blaine");
    expect(heading?.contains(trigger())).toBe(true);
    expect(container.querySelector("[data-tour='projects-list']")).not.toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(search()).toBeNull();
  });

  it("opens on click with a focused search box and every group listed", () => {
    renderPicker();
    act(() => trigger().click());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(search());
    expect(search()?.placeholder).toBe("Search groups...");
    expect(options().map((o) => o.textContent)).toEqual([
      expect.stringContaining("Team Blaine"),
      expect.stringContaining("Johns Kitchen"),
      expect.stringContaining("Platform"),
    ]);
    expect(options()[0].textContent).toContain("12 repositories");
    expect(options()[1].textContent).toContain("1 repository");
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("opens from ArrowDown on the trigger", () => {
    renderPicker();
    key(trigger(), "ArrowDown");
    expect(search()).not.toBeNull();
  });

  it("filters as you type and says so when nothing matches", () => {
    renderPicker();
    act(() => trigger().click());

    type(search()!, "kitch");
    expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining("Johns Kitchen")]);

    type(search()!, "nothing like it");
    expect(options()).toHaveLength(0);
    expect(container.textContent).toContain("No groups match.");
  });

  it("selects the clicked group and closes", () => {
    const { onSelect } = renderPicker();
    act(() => trigger().click());
    act(() => options()[2].click());

    expect(onSelect).toHaveBeenCalledWith("g-3");
    expect(search()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("moves with Up/Down and selects with Enter", () => {
    const { onSelect } = renderPicker();
    act(() => trigger().click());
    // Opens on the selected group.
    expect(activeOption()?.textContent).toContain("Team Blaine");

    key(search()!, "ArrowDown");
    key(search()!, "ArrowDown");
    expect(activeOption()?.textContent).toContain("Platform");
    // Clamped at the end, no wrap.
    key(search()!, "ArrowDown");
    expect(activeOption()?.textContent).toContain("Platform");
    key(search()!, "ArrowUp");
    expect(activeOption()?.textContent).toContain("Johns Kitchen");

    key(search()!, "Enter");
    expect(onSelect).toHaveBeenCalledWith("g-2");
    expect(search()).toBeNull();
  });

  it("closes on Escape, returns focus to the trigger and clears the query", () => {
    const { onSelect } = renderPicker();
    act(() => trigger().click());
    type(search()!, "plat");

    key(search()!, "Escape");
    expect(search()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(onSelect).not.toHaveBeenCalled();

    act(() => trigger().click());
    expect(search()?.value).toBe("");
    expect(options()).toHaveLength(3);
  });

  it("closes when clicking outside, and not when clicking inside", () => {
    renderPicker();
    act(() => trigger().click());

    act(() => {
      search()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(search()).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(search()).toBeNull();
  });

  it("shows the load error in place of the list", () => {
    renderPicker({ options: [], selectedId: null, label: "Choose a group", error: "Could not load groups." });
    act(() => trigger().click());
    expect(container.textContent).toContain("Could not load groups.");
    expect(container.textContent).not.toContain("No groups match.");
    expect(options()).toHaveLength(0);
  });
});
