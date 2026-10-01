import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Dialog } from "../../../../../../src/features/groups/workspace/views/primitives";

/* Lets the dialog's 0 ms "focus the first field" timer run. */
async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function Harness({ onClose, tick }: Readonly<{ onClose: () => void; tick: number }>) {
  return (
    <Dialog open onClose={onClose} title="Edit">
      <input aria-label="First" />
      <input aria-label="Second" data-tick={tick} />
    </Dialog>
  );
}

describe("Dialog focus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const field = (label: string) => document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;

  it("focuses the first field once when it opens", async () => {
    await act(async () => root.render(<Harness onClose={() => undefined} tick={0} />));
    await flushTimers();
    expect(document.activeElement).toBe(field("First"));
  });

  /* Callers pass a new onClose every render; a re-render (a keystroke) used to
   * re-run the open effect and pull focus back to the first field. */
  it("keeps focus where the user put it when it re-renders with a new onClose", async () => {
    await act(async () => root.render(<Harness onClose={() => undefined} tick={0} />));
    await flushTimers();
    act(() => field("Second").focus());

    await act(async () => root.render(<Harness onClose={() => undefined} tick={1} />));
    await flushTimers();

    expect(document.activeElement).toBe(field("Second"));
  });

  it("closes on Escape with the latest onClose", async () => {
    const first = jest.fn();
    const latest = jest.fn();
    await act(async () => root.render(<Harness onClose={first} tick={0} />));
    await act(async () => root.render(<Harness onClose={latest} tick={1} />));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
