import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { TeamActivityView } from "../../../../../../src/features/teams/activity/views/team-activity-view";
import { TeamsDetailView } from "../../../../../../src/features/teams/detail/views/teams-detail-view";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/teams",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../../../../../../src/features/auth/session", () => ({
  useAuthSession: () => ({
    status: "signed-in",
    session: { appRole: "lead", user: { login: "tone-lead" } },
    error: null,
    refresh: jest.fn(),
    signOut: jest.fn(),
    isSigningOut: false,
  }),
  isGuest: () => false,
}));

// The header and sidebar have tests of their own; here they are inert.
jest.mock("../../../../../../src/features/workspace/selection", () => ({
  AppNav: () => null,
  WorkspaceProvider: ({ children }: { children: ReactNode }) => children,
  canCreateWorkspace: () => true,
  useWorkspaceSelection: () => ({ setSelectedWorkspaceId: jest.fn() }),
}));

const mockTeam = {
  id: "ws-1",
  name: "Team Go",
  description: null,
  businessUnit: null,
  status: "active",
  role: "admin",
  memberStatus: "active",
  memberCount: 2,
  systemCount: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
  archivedAt: null,
};

jest.mock("../../../../../../src/features/teams/shell/view-models/use-selected-team-view-model", () => ({
  useSelectedTeamViewModel: () => ({
    team: mockTeam,
    projects: [],
    status: "ready",
    error: null,
    reload: jest.fn(),
    refreshTeam: jest.fn(),
    qaChecklistsEnabled: true,
    capabilitiesKnown: true,
  }),
}));

jest.mock("../../../../../../src/features/groups/activity", () => ({
  GroupActivitySection: () => <p data-testid="activity-feed">feed</p>,
}));

jest.mock("../../../../../../src/features/teams/detail/view-models/use-team-members-view-model", () => ({
  useTeamMembersViewModel: () => ({
    status: "loading",
    canManage: false,
    members: [],
    addOpen: false,
    openAdd: jest.fn(),
    closeAdd: jest.fn(),
    applyAdded: jest.fn(),
    applyChange: jest.fn(),
    reload: jest.fn(),
    currentUserId: "user-lead",
  }),
}));

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
});

function render(node: ReactNode): HTMLElement {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

/* The team pages used to open on a hero card — breadcrumb, the team's name,
 * a chip and a lede — that repeated the header picker and the content card. */
describe("TeamPageShell", () => {
  it("opens /teams straight onto the Members card, with one hidden h1", () => {
    const container = render(<TeamsDetailView />);
    const main = container.querySelector("#main-content")!;

    expect(container.querySelector(".workflow-page-header")).toBeNull();
    expect(container.querySelector(".workflow-page-breadcrumb")).toBeNull();
    expect(container.textContent).not.toContain("Switch or create a team");

    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Members · Team Go");
    expect(h1s[0].className).toBe("sr-only");

    // The first thing drawn after the hidden h1 is the content card.
    const visible = [...main.children].filter((child) => child.tagName !== "H1");
    expect(visible[0].querySelector("h2")?.textContent).toContain("Members");
  });

  it("gives /activity a card heading of its own, labelling the card", () => {
    const container = render(<TeamActivityView />);
    const card = container.querySelector("section.team-detail-surface")!;
    const heading = card.querySelector("h2")!;

    expect(heading.textContent).toBe("Activity & audit");
    expect(heading.className).toBe("group-section-title");
    expect(card.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(card.querySelector('[data-testid="activity-feed"]')).not.toBeNull();
    expect([...container.querySelectorAll("h1")].map((h1) => h1.textContent)).toEqual([
      "Activity & audit · Team Go",
    ]);
  });
});
