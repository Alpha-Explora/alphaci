import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { useStudioFullScreen } from "../../../../../src/features/checklists/studio/view-models/use-studio-full-screen";
import { useStudioViewportViewModel } from "../../../../../src/features/checklists/studio/view-models/use-studio-viewport-view-model";
import type { ProjectBranchPreview } from "../../../../../src/shared/api/contracts";

jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  jest.clearAllMocks();
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

function unmount() {
  act(() => root?.unmount());
  root = null;
}

function pressEscape(init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

describe("useStudioFullScreen", () => {
  it("starts docked, toggles full screen, and exits", () => {
    const vm = renderHook(() => useStudioFullScreen());
    expect(vm().isFullScreen).toBe(false);
    act(() => vm().toggleFullScreen());
    expect(vm().isFullScreen).toBe(true);
    act(() => vm().toggleFullScreen());
    expect(vm().isFullScreen).toBe(false);
    act(() => vm().enterFullScreen());
    act(() => vm().exitFullScreen());
    expect(vm().isFullScreen).toBe(false);
  });

  it("leaves full screen on Escape", () => {
    const vm = renderHook(() => useStudioFullScreen());
    act(() => vm().enterFullScreen());
    pressEscape();
    expect(vm().isFullScreen).toBe(false);
  });

  it("ignores Escape while a dialog is open, checked when the key is pressed", () => {
    const vm = renderHook(() => useStudioFullScreen());
    act(() => vm().enterFullScreen());
    // The dialog opens AFTER full screen began: the listener must look at key time.
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    pressEscape();
    expect(vm().isFullScreen).toBe(true);
    dialog.remove();
    pressEscape();
    expect(vm().isFullScreen).toBe(false);
  });

  it("ignores an Escape something else already handled (a menu closing)", () => {
    const vm = renderHook(() => useStudioFullScreen());
    act(() => vm().enterFullScreen());
    const menuKey = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    menuKey.preventDefault();
    act(() => {
      document.dispatchEvent(menuKey);
    });
    expect(vm().isFullScreen).toBe(true);
    pressEscape({ key: "Enter" });
    expect(vm().isFullScreen).toBe(true);
  });

  it("does nothing on Escape while docked", () => {
    const vm = renderHook(() => useStudioFullScreen());
    pressEscape();
    expect(vm().isFullScreen).toBe(false);
  });

  it("locks the page's scroll while full screen and restores the body's own value on exit", () => {
    document.body.style.overflow = "clip";
    const vm = renderHook(() => useStudioFullScreen());
    act(() => vm().enterFullScreen());
    expect(document.body.style.overflow).toBe("hidden");
    act(() => vm().exitFullScreen());
    expect(document.body.style.overflow).toBe("clip");
  });

  it("restores the body's scroll when unmounted in full screen", () => {
    const vm = renderHook(() => useStudioFullScreen());
    act(() => vm().enterFullScreen());
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
    // And its Escape listener is gone with it.
    pressEscape();
  });

  it("opens, minimizes and toggles the floating checklist, and snaps it between corners", () => {
    const vm = renderHook(() => useStudioFullScreen());
    expect(vm().isChecklistOpen).toBe(false);
    expect(vm().floatingSide).toBe("right");
    act(() => vm().openChecklist());
    expect(vm().isChecklistOpen).toBe(true);
    act(() => vm().minimizeChecklist());
    expect(vm().isChecklistOpen).toBe(false);
    act(() => vm().toggleChecklist());
    expect(vm().isChecklistOpen).toBe(true);
    act(() => vm().snapChecklist());
    expect(vm().floatingSide).toBe("left");
    act(() => vm().snapChecklist());
    expect(vm().floatingSide).toBe("right");
  });

  it("remembers whether the drawer was open across leaving and re-entering full screen", () => {
    const vm = renderHook(() => useStudioFullScreen());
    act(() => vm().enterFullScreen());
    act(() => vm().openChecklist());
    act(() => vm().exitFullScreen());
    act(() => vm().enterFullScreen());
    expect(vm().isChecklistOpen).toBe(true);
  });
});

function preview(overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch: "uat",
    isProduction: false,
    deploymentId: "d1",
    targetId: "web",
    targetName: "storefront-web",
    provider: "vercel",
    status: "ready",
    commitSha: "abc1234",
    commitMessage: null,
    pullRequestNumber: null,
    previewUrl: "https://shop.example.com",
    inspectorUrl: null,
    createdAt: null,
    readyAt: null,
    embeddable: true,
    embedBlockedReason: null,
    surface: "page",
    ...overrides,
  };
}

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("useStudioViewportViewModel", () => {
  beforeEach(() => {
    projects.previews.mockResolvedValue({
      enabled: true,
      liveProvidersEnabled: true,
      providerError: null,
      branches: [preview({ branch: "main", isProduction: true }), preview()],
    });
  });

  it("offers only the uat environment, even with a production main deployment", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().environments.map((env) => env.branch)).toEqual(["uat"]);
    expect(vm().environment?.branch).toBe("uat");
  });

  it("rotates tablet and mobile, keeps the choice across devices, and never rotates Desktop", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().device.id).toBe("desktop");
    expect(vm().canRotate).toBe(false);
    act(() => vm().rotate());
    expect(vm().orientation).toBe("portrait");
    expect(vm().dimensions).toEqual({ width: 1440, height: 900, orientation: "landscape" });

    act(() => vm().setDevice("tablet"));
    expect(vm().canRotate).toBe(true);
    expect(vm().dimensions).toEqual({ width: 768, height: 1024, orientation: "portrait" });
    act(() => vm().rotate());
    expect(vm().dimensions).toEqual({ width: 1024, height: 768, orientation: "landscape" });

    act(() => vm().setDevice("mobile"));
    expect(vm().dimensions).toEqual({ width: 812, height: 375, orientation: "landscape" });
    act(() => vm().rotate());
    expect(vm().dimensions).toEqual({ width: 375, height: 812, orientation: "portrait" });
  });

  it("never changes the frame key for device, orientation or full screen — only for a new page", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    const key = vm().frameKey;
    act(() => vm().setDevice("mobile"));
    act(() => vm().rotate());
    act(() => vm().enterFullScreen());
    act(() => vm().openChecklist());
    act(() => vm().exitFullScreen());
    expect(vm().frameKey).toBe(key);
    act(() => vm().reload());
    expect(vm().frameKey).not.toBe(key);
  });
});
