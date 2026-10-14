import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { useStudioFullScreen } from "../../../../../src/features/checklists/studio/view-models/use-studio-full-screen";
import {
  STUDIO_LAYOUT_KEY,
  useStudioLayout,
} from "../../../../../src/features/checklists/studio/view-models/use-studio-layout";
import { STUDIO_RESOLUTION_KEYS } from "../../../../../src/features/checklists/studio/view-models/use-studio-resolution";
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
  window.localStorage.clear();
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

  it("never changes the frame key for device, orientation, layout or full screen — only for a new page", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    const key = vm().frameKey;
    act(() => vm().setDevice("mobile"));
    act(() => vm().rotate());
    act(() => vm().setLayout("split"));
    act(() => vm().enterFullScreen());
    act(() => vm().openChecklist());
    act(() => vm().exitFullScreen());
    expect(vm().frameKey).toBe(key);
    act(() => vm().reload());
    expect(vm().frameKey).not.toBe(key);
  });

  it("opens each class on its default size and switches resolution, rotation still applying", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().resolution).toMatchObject({ choice: "1440x900", width: 1440, height: 900 });

    act(() => vm().setResolution("1920x1080"));
    expect(vm().resolution.choice).toBe("1920x1080");
    expect(vm().dimensions).toEqual({ width: 1920, height: 1080, orientation: "landscape" });

    act(() => vm().setDevice("mobile"));
    expect(vm().resolution.choice).toBe("375x812");
    act(() => vm().setResolution("390x844"));
    expect(vm().dimensions).toEqual({ width: 390, height: 844, orientation: "portrait" });
    act(() => vm().rotate());
    expect(vm().dimensions).toEqual({ width: 844, height: 390, orientation: "landscape" });

    // Each class keeps its own size.
    act(() => vm().setDevice("desktop"));
    expect(vm().dimensions).toEqual({ width: 1920, height: 1080, orientation: "landscape" });
    act(() => vm().setDevice("tablet"));
    expect(vm().resolution.choice).toBe("768x1024");
  });

  it("does not re-mount the frame when the resolution changes", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    const key = vm().frameKey;
    act(() => vm().setResolution("2560x1440"));
    act(() => vm().setCustomResolution(1500, 900));
    act(() => vm().setDevice("mobile"));
    act(() => vm().setResolution("custom"));
    expect(vm().frameKey).toBe(key);
  });

  it("starts Custom from the size in view, then takes a typed size", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    act(() => vm().setResolution("1920x1080"));
    act(() => vm().setResolution("custom"));
    expect(vm().resolution).toMatchObject({ choice: "custom:1920x1080", width: 1920, height: 1080, preset: null });
    act(() => vm().setCustomResolution(1500, 900));
    expect(vm().resolution).toMatchObject({ choice: "custom:1500x900", preset: null });
    expect(vm().dimensions).toEqual({ width: 1500, height: 900, orientation: "landscape" });
    // Back to a preset leaves Custom.
    act(() => vm().setResolution("1366x768"));
    expect(vm().resolution.preset).not.toBeNull();
  });

  it("falls back to the default for a size it was never offered", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    act(() => vm().setResolution("9999x9999"));
    expect(vm().resolution.choice).toBe("1440x900");
    act(() => vm().setCustomResolution(10, 10));
    expect(vm().resolution.choice).toBe("1440x900");
  });

  it("remembers the resolution per device class in this browser", async () => {
    const first = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    act(() => first().setResolution("1920x1080"));
    act(() => first().setDevice("mobile"));
    act(() => first().setCustomResolution(400, 900));
    expect(window.localStorage.getItem(STUDIO_RESOLUTION_KEYS.desktop)).toBe("1920x1080");
    expect(window.localStorage.getItem(STUDIO_RESOLUTION_KEYS.mobile)).toBe("custom:400x900");
    unmount();

    const again = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(again().dimensions).toMatchObject({ width: 1920, height: 1080 });
    act(() => again().setDevice("mobile"));
    expect(again().resolution).toMatchObject({ choice: "custom:400x900", width: 400, height: 900 });
  });

  it("uses the default when storage holds an unknown or out-of-range value", async () => {
    window.localStorage.setItem(STUDIO_RESOLUTION_KEYS.desktop, "1111x1111");
    window.localStorage.setItem(STUDIO_RESOLUTION_KEYS.mobile, "custom:50x50");
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().resolution.choice).toBe("1440x900");
    act(() => vm().setDevice("mobile"));
    expect(vm().resolution.choice).toBe("375x812");
  });

  it("opens the environment's root, with its host", async () => {
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().pageUrl).toBe("https://shop.example.com/");
    expect(vm().host).toBe("shop.example.com");
  });
});

describe("useStudioViewportViewModel copy link", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    projects.previews.mockResolvedValue({
      enabled: true,
      liveProvidersEnabled: true,
      providerError: null,
      branches: [preview()],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("writes the page url to the clipboard, says Copied, and goes back to idle after two seconds", async () => {
    writeText.mockResolvedValue(undefined);
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().copyLinkStatus).toBe("idle");
    await act(async () => {
      await vm().copyLink();
    });
    expect(writeText).toHaveBeenCalledWith("https://shop.example.com/");
    expect(vm().copyLinkStatus).toBe("copied");
    act(() => {
      jest.advanceTimersByTime(1_900);
    });
    expect(vm().copyLinkStatus).toBe("copied");
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(vm().copyLinkStatus).toBe("idle");
  });

  it("reports a refused copy instead of pretending, then recovers", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    await act(async () => {
      await vm().copyLink();
    });
    expect(vm().copyLinkStatus).toBe("failed");
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(vm().copyLinkStatus).toBe("idle");
  });

  it("reports a missing clipboard the same way", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    await act(async () => {
      await vm().copyLink();
    });
    expect(vm().copyLinkStatus).toBe("failed");
  });

  it("copies nothing when there is no page", async () => {
    projects.previews.mockResolvedValue({ enabled: true, liveProvidersEnabled: true, providerError: null, branches: [] });
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().pageUrl).toBeNull();
    await act(async () => {
      await vm().copyLink();
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(vm().copyLinkStatus).toBe("idle");
  });
});

describe("useStudioLayout", () => {
  it("starts on wide preview, switches, and remembers the choice in this browser", () => {
    const vm = renderHook(() => useStudioLayout());
    expect(vm().layout).toBe("wide");
    act(() => vm().setLayout("split"));
    expect(vm().layout).toBe("split");
    expect(window.localStorage.getItem(STUDIO_LAYOUT_KEY)).toBe("split");
    unmount();
    expect(renderHook(() => useStudioLayout())().layout).toBe("split");
  });

  it("falls back to wide preview for a stored value it does not know", () => {
    window.localStorage.setItem(STUDIO_LAYOUT_KEY, "stacked");
    expect(renderHook(() => useStudioLayout())().layout).toBe("wide");
  });

  it("still switches when storage throws, and starts on wide preview", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const vm = renderHook(() => useStudioLayout());
    expect(vm().layout).toBe("wide");
    act(() => vm().setLayout("split"));
    expect(vm().layout).toBe("split");
    get.mockRestore();
    set.mockRestore();
  });

  it("rides on the viewport ViewModel, so every studio on the shell has it", async () => {
    projects.previews.mockResolvedValue({ enabled: true, liveProvidersEnabled: true, providerError: null, branches: [] });
    window.localStorage.setItem(STUDIO_LAYOUT_KEY, "split");
    const vm = renderHook(() => useStudioViewportViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().layout).toBe("split");
    act(() => vm().setLayout("wide"));
    expect(vm().layout).toBe("wide");
  });
});
