import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useStudioCaptureTarget } from "../../../../../src/features/checklists/studio/view-models/use-studio-capture-target";

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function renderHook<T>(useHook: () => T): () => T {
  let latest: T | undefined;
  const record = (value: T) => {
    latest = value;
  };
  function Probe({ onRender }: { onRender: (value: T) => void }) {
    onRender(useHook());
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Probe onRender={record} />));
  return () => latest as T;
}

/*
 * A capture takes the tab's pixels where the preview is, so the run panel
 * floating over it must be out of the picture while the frame is grabbed —
 * and back as soon as it is, whatever the capture did.
 */
describe("useStudioCaptureTarget", () => {
  it("is one target for the studio's lifetime, with the frame's ref", () => {
    const vm = renderHook(() => useStudioCaptureTarget());
    const first = vm().target;
    expect(first.current).toBeNull();
    act(() => root!.render(null));
    expect(vm().target).toBe(first);
  });

  it("is capturing only while the capture runs, after a paint", async () => {
    const vm = renderHook(() => useStudioCaptureTarget());
    expect(vm().capturing).toBe(false);
    const grab = jest.fn();
    let release: () => void = () => undefined;
    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = vm().target.whileCapturing!(() => {
        grab();
        return new Promise((resolve) => {
          release = () => resolve("image");
        });
      });
      // Two animation frames, then the grab starts.
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(grab).toHaveBeenCalledTimes(1);
    expect(vm().capturing).toBe(true);
    await act(async () => {
      release();
      await expect(pending).resolves.toBe("image");
    });
    expect(vm().capturing).toBe(false);
  });

  it("puts the panel back when the capture fails, and passes the failure on", async () => {
    const vm = renderHook(() => useStudioCaptureTarget());
    let failure: unknown = null;
    await act(async () => {
      try {
        await vm().target.whileCapturing!(() => Promise.reject(new Error("denied")));
      } catch (cause) {
        failure = cause;
      }
    });
    expect((failure as Error | null)?.message).toBe("denied");
    expect(vm().capturing).toBe(false);
  });
});
