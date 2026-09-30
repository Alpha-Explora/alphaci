import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SelectedTeamSettings } from "../../../../../../src/features/teams/settings/views/selected-team-settings";
import type { SelectedTeamViewModel } from "../../../../../../src/features/teams/shell/view-models/use-selected-team-view-model";
import type { GroupSummary } from "../../../../../../src/features/groups/data/hierarchy-contracts";
import { ApiError } from "../../../../../../src/shared/api/request";

const mockVm: { current: SelectedTeamViewModel | null } = { current: null };
jest.mock("../../../../../../src/features/teams/shell", () => ({
  useSelectedTeamViewModel: () => mockVm.current,
}));

jest.mock("../../../../../../src/features/groups/data/hierarchy-api", () => ({
  getGroupMembers: jest.fn(),
  updateGroup: jest.fn(),
  archiveGroup: jest.fn(),
  reopenGroup: jest.fn(),
  transferGroup: jest.fn(),
  deleteGroup: jest.fn(),
}));

const api = jest.requireMock("../../../../../../src/features/groups/data/hierarchy-api") as Record<
  string,
  jest.Mock
>;

const TEAM: GroupSummary = {
  id: "ws-1",
  name: "Checkout squad",
  description: null,
  businessUnit: null,
  status: "active",
  role: "admin",
  memberStatus: "active",
  memberCount: 2,
  systemCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
};

function vm(overrides: Partial<SelectedTeamViewModel> = {}): SelectedTeamViewModel {
  return {
    team: TEAM,
    projects: [],
    status: "ready",
    error: null,
    reload: jest.fn(),
    refreshTeam: jest.fn(),
    qaChecklistsEnabled: false,
    capabilitiesKnown: true,
    ...overrides,
  };
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function render(model: SelectedTeamViewModel): Promise<HTMLElement> {
  mockVm.current = model;
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<SelectedTeamSettings />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

function button(container: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((el) => el.textContent === name);
}

describe("SelectedTeamSettings (the Settings page's Team tab)", () => {
  beforeEach(() => {
    api.getGroupMembers.mockResolvedValue([]);
  });

  it("shows the Lead the team's details, Lead, archive and delete controls", async () => {
    const container = await render(vm());
    expect(container.textContent).toContain("Details");
    expect(container.textContent).toContain("Lead");
    expect(button(container, "Archive team")).toBeDefined();
    expect(button(container, "Delete team")).toBeDefined();
    expect(api.getGroupMembers).toHaveBeenCalledWith("ws-1");
  });

  /* Allow-listed: only the team's Lead or Delegated lead gets a control. */
  it("shows a member no controls, and where to see the roster instead", async () => {
    const container = await render(vm({ team: { ...TEAM, role: "member" } }));
    expect(container.querySelector("input, textarea, select")).toBeNull();
    expect(button(container, "Delete team")).toBeUndefined();
    expect(container.textContent).toContain("Only a Lead or Delegated lead of Checkout squad");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/teams?workspace=ws-1");
  });

  it("gives a Delegated lead the controls too", async () => {
    const container = await render(vm({ team: { ...TEAM, role: "delegated_lead" } }));
    expect(button(container, "Save changes")).toBeDefined();
  });

  it("waits for the team, and says when there is none", async () => {
    const loading = await render(vm({ status: "loading", team: null }));
    expect(loading.querySelector(".hier-skeleton")).not.toBeNull();
    act(() => root?.unmount());
    root = null;

    const none = await render(vm({ team: null }));
    expect(none.textContent).toContain("You are not in a team yet.");
  });

  it("archives the team and re-reads it", async () => {
    api.archiveGroup.mockResolvedValue({ ...TEAM, status: "archived" });
    const model = vm();
    const container = await render(model);
    await act(async () => button(container, "Archive team")!.click());
    expect(api.archiveGroup).toHaveBeenCalledWith("ws-1");
    expect(model.refreshTeam).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Team archived.");
  });

  it("deletes the team after confirming, then drops it from the header", async () => {
    api.deleteGroup.mockResolvedValue(undefined);
    const model = vm();
    const container = await render(model);
    await act(async () => button(container, "Delete team")!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Delete "Checkout squad"?');
    await act(async () => {
      dialog.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(api.deleteGroup).toHaveBeenCalledWith("ws-1");
    expect(model.reload).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open with a message when the delete is refused", async () => {
    api.deleteGroup.mockRejectedValue(new ApiError("Forbidden", 403));
    const model = vm();
    const container = await render(model);
    await act(async () => button(container, "Delete team")!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    await act(async () => {
      dialog.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "You're not allowed to delete this team.",
    );
    expect(model.reload).not.toHaveBeenCalled();
  });
});
