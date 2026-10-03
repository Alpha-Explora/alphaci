import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/* The project page's header: it names the project's own team, and picking
 * another team leaves for that team's Projects page. Before, the page had no
 * WorkspaceProvider, so the header showed the viewer's first team and a pick
 * did nothing. The real AppNav and switcher render; only data is mocked. */

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ projectId: "p-1" }),
  usePathname: () => "/projects/p-1",
}));

jest.mock("../../../../../../src/features/auth/session", () => ({
  useAuthSession: () => ({
    status: "signed-in",
    session: {
      authenticated: true,
      user: { id: "u-1", login: "dev", onboardingCompleted: true },
      subscription: { plan: "free", status: "active", provider: "none", updatedAt: "2026-01-01" },
      appRole: "member",
    },
    error: null,
    refresh: jest.fn(),
    signOut: jest.fn(),
    isSigningOut: false,
  }),
  isGuest: () => false,
}));

/* The overview resolves after mount, as it does in the app: the test hands
 * the project's team over by re-rendering with `mockOverview` set. */
let mockOverview: { project: { id: string; repoFullName: string; workspaceId: string | null } } | null =
  null;
jest.mock("../../../../../../src/features/projects/detail/view-models/use-project-detail-view-model", () => ({
  useProjectDetailViewModel: () => ({
    overview: mockOverview,
    status: mockOverview ? "ready" : "loading",
    error: null,
    reload: jest.fn(),
    enforcedOrg: undefined,
  }),
}));
jest.mock("../../../../../../src/features/projects/detail/view-models/use-project-folder-view-model", () => ({
  useProjectFolderViewModel: () => ({}),
}));
jest.mock("../../../../../../src/features/projects/detail/views/project-detail-tabs", () => ({
  ProjectDetailTabs: () => null,
}));
jest.mock("../../../../../../src/features/runs/list", () => ({ RunsSkeleton: () => null }));
jest.mock("../../../../../../src/shared/layout/flow-background", () => ({ FlowBackground: () => null }));

jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({ qaChecklistsEnabled: false }),
}));
jest.mock("../../../../../../src/features/notifications/summary", () => ({
  useNotificationsSummaryViewModel: () => ({ unreadCount: 0 }),
}));
jest.mock("../../../../../../src/features/workspace/selection/data/workspace-repository", () => ({
  getWorkspaces: jest.fn(),
  getVisibleTeams: jest.fn(),
}));

import { ProjectDetailView } from "../../../../../../src/features/projects/detail/views/project-detail-view";
import { getWorkspaces } from "../../../../../../src/features/workspace/selection/data/workspace-repository";

const mockedGetWorkspaces = getWorkspaces as jest.MockedFunction<typeof getWorkspaces>;

const TEAMS = {
  enabled: true,
  items: [
    { id: "t-blaine", name: "Team Blaine", kind: "team" as const, role: "member" as const },
    { id: "t-a", name: "Team A", kind: "team" as const, role: "member" as const },
    { id: "t-c", name: "Team C", kind: "team" as const, role: "member" as const },
  ],
};

let root: Root | null = null;
let container: HTMLElement;

beforeEach(() => {
  mockOverview = null;
  mockedGetWorkspaces.mockResolvedValue(TEAMS);
  // The team the viewer last had open elsewhere: what the header used to show.
  window.localStorage.setItem("flowci.workspaceId", "t-blaine");
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
  jest.clearAllMocks();
});

async function render() {
  await act(async () => {
    root!.render(<ProjectDetailView />);
  });
}

async function openProject(workspaceId: string | null) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
  mockOverview = { project: { id: "p-1", repoFullName: "org/repo", workspaceId } };
  await render();
}

function trigger(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
}

function pick(name: string) {
  act(() => {
    trigger().dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const option = [...container.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (node) => node.textContent === name,
  )!;
  act(() => {
    option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("ProjectDetailView header team", () => {
  it("names the project's team once its overview loads", async () => {
    await openProject("t-a");

    expect(trigger().textContent).toContain("Team A");
    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("t-a");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("leaves for the picked team's Projects page, and the pick stands", async () => {
    await openProject("t-a");
    pick("Team C");

    expect(mockPush).toHaveBeenCalledWith("/workflows?group=t-c");
    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("t-c");
    // Re-rendering with the same project must not snap the header back.
    await render();
    expect(trigger().textContent).toContain("Team C");
  });

  it("keeps the remembered team when the project's team is not listed", async () => {
    await openProject("t-hidden");

    expect(trigger().textContent).toContain("Team Blaine");
    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("t-blaine");
  });
});
