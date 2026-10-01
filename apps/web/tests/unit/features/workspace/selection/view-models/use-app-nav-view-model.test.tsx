import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceProvider } from "../../../../../../src/features/workspace/selection/views/workspace-selection-context";
import { useAppNavViewModel } from "../../../../../../src/features/workspace/selection/view-models/use-app-nav-view-model";
import type { WorkspaceSummary } from "../../../../../../src/features/workspace/selection/model/workspace-types";

jest.mock("next/navigation", () => ({ usePathname: () => "/teams" }));

jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({ qaChecklistsEnabled: true }),
}));

jest.mock("../../../../../../src/features/notifications/summary", () => ({
  useNotificationsSummaryViewModel: () => ({ unreadCount: 0 }),
}));

jest.mock("../../../../../../src/features/workspace/selection/data/workspace-repository", () => ({
  getWorkspaces: jest.fn(),
  getVisibleTeams: jest.fn(),
}));

import { getWorkspaces } from "../../../../../../src/features/workspace/selection/data/workspace-repository";

const mockedGetWorkspaces = getWorkspaces as jest.MockedFunction<typeof getWorkspaces>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  window.localStorage.clear();
  jest.clearAllMocks();
});

async function mainItemsFor(
  teamRole: WorkspaceSummary["role"],
  session: { appRole: "admin" | "lead" | "qa" | "member"; platformRole?: string | null },
): Promise<string[]> {
  if (root) act(() => root?.unmount());
  window.localStorage.clear();
  mockedGetWorkspaces.mockResolvedValue({
    enabled: true,
    items: [{ id: "ws-1", name: "Checkout squad", kind: "team", role: teamRole }],
  });
  const captured: { items: string[] } = { items: [] };
  function Probe() {
    const vm = useAppNavViewModel({ guest: false, ...session });
    // A probe exists to hand the hook's value back to the test.
    // eslint-disable-next-line react-hooks/immutability
    captured.items = vm.mainItems;
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root!.render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
  });
  return captured.items;
}

/* The /activity feed is per team. The backend derives the team role from the
 * global app role, so it opens the feed to Team leads who belong to the team
 * and to platform admins; the stored per-team role does not decide. */
describe("useAppNavViewModel Activity entry", () => {
  it("shows Activity to the header team's Lead", async () => {
    expect(await mainItemsFor("admin", { appRole: "lead" })).toContain("activity");
  });

  it("shows Activity to a Team lead whose stored team role is member", async () => {
    expect(await mainItemsFor("member", { appRole: "lead" })).toContain("activity");
  });

  it("hides Activity from a Developer with a stored Delegated lead role", async () => {
    expect(await mainItemsFor("delegated_lead", { appRole: "member" })).not.toContain("activity");
  });

  it("hides Activity from a QA Team member of the team", async () => {
    const items = await mainItemsFor("member", { appRole: "qa" });
    expect(items).not.toContain("activity");
    expect(items).toEqual(["home", "projects", "teams", "checklists", "inbox"]);
  });

  it("hides Activity from a Developer", async () => {
    expect(await mainItemsFor("member", { appRole: "member" })).not.toContain("activity");
  });

  it("shows Activity to a platform admin on a team they only belong to as a member", async () => {
    expect(await mainItemsFor("member", { appRole: "admin" })).toContain("activity");
    expect(await mainItemsFor("member", { appRole: "member", platformRole: "super_admin" })).toContain(
      "activity",
    );
  });
});
