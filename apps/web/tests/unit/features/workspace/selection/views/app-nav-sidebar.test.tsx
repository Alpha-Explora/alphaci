import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/* The left rail's own structure: the pin toggle lives in the rail (not the
 * header), the groups are split by plain dividers with no "Main"/"Account"
 * words, and the inbox keeps its unread dot. The real AppNav renders; only
 * data is mocked. Whether the dot is visible is layout (see app-shell.css),
 * which jsdom cannot measure; the e2e visual check covers that. */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/home",
}));

jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({ qaChecklistsEnabled: false }),
}));
jest.mock("../../../../../../src/features/notifications/summary", () => ({
  useNotificationsSummaryViewModel: () => ({ unreadCount: 14 }),
}));
jest.mock("../../../../../../src/features/workspace/selection/data/workspace-repository", () => ({
  getWorkspaces: jest.fn().mockResolvedValue({ enabled: true, items: [] }),
  getVisibleTeams: jest.fn().mockResolvedValue({ enabled: true, items: [] }),
}));

import type { AuthSession } from "../../../../../../src/features/auth/session";
import { SIDEBAR_PINNED_ATTRIBUTE } from "../../../../../../src/features/workspace/selection/model/sidebar-pin";
import { AppNav } from "../../../../../../src/features/workspace/selection/views/app-nav";
import { WorkspaceProvider } from "../../../../../../src/features/workspace/selection/views/workspace-selection-context";

const SESSION = {
  authenticated: true,
  user: { id: "u-1", login: "ana-qa", onboardingCompleted: true },
  subscription: { plan: "free", status: "active", provider: "none", updatedAt: "2026-01-01" },
  appRole: "qa",
} as unknown as AuthSession;

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <WorkspaceProvider>
        <AppNav guest={false} session={SESSION} onLogout={jest.fn()} isLoggingOut={false} />
      </WorkspaceProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  document.documentElement.removeAttribute(SIDEBAR_PINNED_ATTRIBUTE);
});

const rail = () => container.querySelector<HTMLElement>("aside.app-sidebar")!;
const toggle = () => container.querySelector<HTMLButtonElement>("button[aria-pressed]")!;

describe("AppNav left rail", () => {
  it("has no 'Main' or 'Account' headings, only dividers between the groups", () => {
    expect(rail().textContent).not.toMatch(/\bMain\b|\bAccount\b/);
    // One under the toggle, one before Settings.
    expect(rail().querySelectorAll(".sidebar-section-divider")).toHaveLength(2);
  });

  it("puts the pin toggle in the rail, above the nav, not in the header", () => {
    expect(container.querySelector("header.app-header button[aria-pressed]")).toBeNull();
    expect(rail().contains(toggle())).toBe(true);
    expect(rail().querySelector("nav")?.contains(toggle())).toBe(false);
    // One accessible name; aria-pressed carries the state.
    expect(toggle().textContent).toBe("Keep open");
  });

  it("pins and unpins the rail", () => {
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    act(() => toggle().click());
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.getAttribute(SIDEBAR_PINNED_ATTRIBUTE)).toBe("true");

    act(() => toggle().click());
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.hasAttribute(SIDEBAR_PINNED_ATTRIBUTE)).toBe(false);
    // Unpinned under the cursor: the rail folds now rather than staying open on hover.
    expect(rail().getAttribute("data-hover-suppressed")).toBe("true");
  });

  it("marks the inbox with an unread dot and the count", () => {
    const inbox = [...rail().querySelectorAll("a")].find((link) => link.textContent?.includes("Inbox"))!;
    expect(inbox.querySelector(".sidebar-nav-dot")).not.toBeNull();
    expect(inbox.querySelector(".sidebar-nav-count")?.textContent).toBe("14");
  });
});
