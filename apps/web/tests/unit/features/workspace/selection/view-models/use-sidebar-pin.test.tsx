import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  SIDEBAR_PINNED_ATTRIBUTE,
  SIDEBAR_PINNED_KEY,
} from "../../../../../../src/features/workspace/selection/model/sidebar-pin";
import { useSidebarPin } from "../../../../../../src/features/workspace/selection/view-models/use-sidebar-pin";

/* The pin's whole contract: the toggle's pressed state, the <html> attribute
 * the stylesheet widens the rail and the page off, and the stored preference,
 * all moving together. A second consumer stands in for a second header. */

function Toggle({ id }: Readonly<{ id: string }>) {
  const [pinned, toggle] = useSidebarPin();
  return (
    <button type="button" data-id={id} aria-pressed={pinned} onClick={toggle}>
      pin
    </button>
  );
}

let root: Root;
let container: HTMLDivElement;

const button = (id = "a") => container.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)!;
const htmlPinned = () => document.documentElement.getAttribute(SIDEBAR_PINNED_ATTRIBUTE);

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  document.documentElement.removeAttribute(SIDEBAR_PINNED_ATTRIBUTE);
});

describe("useSidebarPin", () => {
  it("starts unpinned when nothing is stored", () => {
    act(() => root.render(<Toggle id="a" />));
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(htmlPinned()).toBeNull();
  });

  it("starts pinned when the viewer pinned it on an earlier visit", () => {
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, "1");
    act(() => root.render(<Toggle id="a" />));
    expect(button().getAttribute("aria-pressed")).toBe("true");
  });

  it("pins and unpins: pressed state, <html> and storage move together, in every consumer", () => {
    act(() => root.render(<><Toggle id="a" /><Toggle id="b" /></>));

    act(() => button("a").click());
    expect(button("a").getAttribute("aria-pressed")).toBe("true");
    expect(button("b").getAttribute("aria-pressed")).toBe("true");
    expect(htmlPinned()).toBe("true");
    expect(window.localStorage.getItem(SIDEBAR_PINNED_KEY)).toBe("1");

    act(() => button("b").click());
    expect(button("a").getAttribute("aria-pressed")).toBe("false");
    expect(htmlPinned()).toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_PINNED_KEY)).toBe("0");
  });

  it("follows a pin made in another tab", () => {
    act(() => root.render(<Toggle id="a" />));
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, "1");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SIDEBAR_PINNED_KEY, newValue: "1" }));
    });
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(htmlPinned()).toBe("true");
  });
});
