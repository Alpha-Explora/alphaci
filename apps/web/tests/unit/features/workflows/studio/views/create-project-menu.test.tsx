import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CreateProjectActions } from "../../../../../../src/features/workflows/studio/views/create-project-menu";

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

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>("[data-testid='create-menu-button']")!;
}

function menu(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>("[role='menu']");
}

function items(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[role='menuitem']")];
}

function key(target: Element, name: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
  });
}

function full(overrides: Partial<Parameters<typeof CreateProjectActions>[0]> = {}) {
  const onCreateProject = jest.fn();
  const onCreateEmptyProject = jest.fn();
  const container = render(
    <CreateProjectActions
      onCreateProject={onCreateProject}
      onCreateEmptyProject={onCreateEmptyProject}
      addRepositoryHref="/workflows?tab=setup&group=ws-1"
      {...overrides}
    />,
  );
  return { container, onCreateProject, onCreateEmptyProject };
}

describe("CreateProjectActions", () => {
  it("is one primary Create project plus a '⋯' menu button", () => {
    const { container, onCreateProject } = full();
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(["Create project", ""]);
    expect(buttons[0].className).toContain("primary-button");

    const more = trigger(container);
    expect(more.getAttribute("aria-haspopup")).toBe("menu");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(more.getAttribute("aria-label")).toBe("More ways to create");
    expect(menu(container)).toBeNull();

    act(() => buttons[0].click());
    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });

  it("opens on a click with Empty project and Add repository, focus on the first", () => {
    const { container } = full();
    act(() => trigger(container).click());
    expect(trigger(container).getAttribute("aria-expanded")).toBe("true");
    expect(trigger(container).getAttribute("aria-controls")).toBe(menu(container)?.id);
    expect(menu(container)?.getAttribute("aria-labelledby")).toBe(trigger(container).id);
    expect(items(container).map((item) => item.querySelector(".create-menu-label")?.textContent)).toEqual([
      "Empty project",
      "Add repository",
    ]);
    expect(document.activeElement).toBe(items(container)[0]);
    expect(items(container)[1].getAttribute("href")).toBe("/workflows?tab=setup&group=ws-1");
  });

  it("moves with the arrow keys (wrapping), Home and End", () => {
    const { container } = full();
    act(() => trigger(container).click());
    const list = menu(container)!;
    key(list, "ArrowDown");
    expect(document.activeElement).toBe(items(container)[1]);
    key(list, "ArrowDown");
    expect(document.activeElement).toBe(items(container)[0]);
    key(list, "ArrowUp");
    expect(document.activeElement).toBe(items(container)[1]);
    key(list, "Home");
    expect(document.activeElement).toBe(items(container)[0]);
    key(list, "End");
    expect(document.activeElement).toBe(items(container)[1]);
  });

  it("opens from the keyboard on the first or the last item", () => {
    const { container } = full();
    key(trigger(container), "ArrowDown");
    expect(document.activeElement).toBe(items(container)[0]);
    key(menu(container)!, "Escape");

    key(trigger(container), "ArrowUp");
    expect(document.activeElement).toBe(items(container)[1]);
  });

  it("closes on Escape and gives focus back to the trigger", () => {
    const { container } = full();
    act(() => trigger(container).click());
    key(menu(container)!, "Escape");
    expect(menu(container)).toBeNull();
    expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger(container));
  });

  it("closes on Tab and on a press outside", () => {
    const { container } = full();
    act(() => trigger(container).click());
    key(menu(container)!, "Tab");
    expect(menu(container)).toBeNull();

    act(() => trigger(container).click());
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(menu(container)).toBeNull();
  });

  it("runs Empty project and closes", () => {
    const { container, onCreateEmptyProject } = full();
    act(() => trigger(container).click());
    act(() => items(container)[0].click());
    expect(onCreateEmptyProject).toHaveBeenCalledTimes(1);
    expect(menu(container)).toBeNull();
  });

  it("shows only the items the caller's role allows", () => {
    const { container } = full({ onCreateEmptyProject: null });
    act(() => trigger(container).click());
    expect(items(container).map((item) => item.textContent)).toEqual([
      expect.stringContaining("Add repository"),
    ]);
  });

  it("drops the menu button when no item is allowed, and everything when nothing is", () => {
    const menuless = full({ onCreateEmptyProject: null, addRepositoryHref: null });
    expect(trigger(menuless.container)).toBeNull();
    expect(menuless.container.textContent).toContain("Create project");
    act(() => root?.unmount());
    root = null;

    const nothing = full({
      onCreateProject: null,
      onCreateEmptyProject: null,
      addRepositoryHref: null,
    });
    expect(nothing.container.innerHTML).toBe("");
  });

  it("keeps the menu for a role that may add to a Project but not start the wizard", () => {
    const { container } = full({ onCreateProject: null, addRepositoryHref: null });
    expect(container.textContent).not.toContain("Create project");
    act(() => trigger(container).click());
    expect(items(container)).toHaveLength(1);
  });
});
