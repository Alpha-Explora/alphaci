import {
  SIDEBAR_PINNED_ATTRIBUTE,
  SIDEBAR_PINNED_KEY,
  SIDEBAR_PIN_BOOT_SCRIPT,
  sidebarPinnedFrom,
  storedSidebarPinned,
} from "../../../../../../src/features/workspace/selection/model/sidebar-pin";

/* Runs the boot script the way the browser does: as source, in the page. */
function runBootScript() {
  new Function(SIDEBAR_PIN_BOOT_SCRIPT)();
}

describe("sidebar pin rules", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute(SIDEBAR_PINNED_ATTRIBUTE);
    jest.restoreAllMocks();
  });

  it("is pinned only for the stored '1'; nothing or anything else is unpinned", () => {
    expect(sidebarPinnedFrom("1")).toBe(true);
    expect(sidebarPinnedFrom("0")).toBe(false);
    expect(sidebarPinnedFrom(null)).toBe(false);
    expect(sidebarPinnedFrom("true")).toBe(false);
    expect(storedSidebarPinned(true)).toBe("1");
    expect(storedSidebarPinned(false)).toBe("0");
  });

  it("boot script marks <html> before hydration when the rail was pinned", () => {
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, "1");
    runBootScript();
    expect(document.documentElement.getAttribute(SIDEBAR_PINNED_ATTRIBUTE)).toBe("true");
  });

  it("boot script leaves <html> alone when unpinned or never chosen", () => {
    runBootScript();
    expect(document.documentElement.hasAttribute(SIDEBAR_PINNED_ATTRIBUTE)).toBe(false);
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, "0");
    runBootScript();
    expect(document.documentElement.hasAttribute(SIDEBAR_PINNED_ATTRIBUTE)).toBe(false);
  });

  it("boot script survives storage that throws (private window, blocked site data)", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.hasAttribute(SIDEBAR_PINNED_ATTRIBUTE)).toBe(false);
  });
});
