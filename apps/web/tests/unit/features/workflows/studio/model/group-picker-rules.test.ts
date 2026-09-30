import {
  chooseInitialGroupId,
  createWorkspaceForGroup,
  filterGroupsByName,
  initialActiveIndex,
  repositoryCountText,
  searchWithGroup,
  stepActiveIndex,
} from "../../../../../../src/features/workflows/studio/model/group-picker-rules";
import { searchWithoutTab } from "../../../../../../src/features/workflows/studio/model/workflow-studio-rules";

const GROUPS = [
  { id: "g-1", name: "Team Blaine" },
  { id: "g-2", name: "Johns Kitchen" },
  { id: "g-3", name: "Platform" },
];

describe("filterGroupsByName", () => {
  it("returns every group for a blank or whitespace query", () => {
    expect(filterGroupsByName(GROUPS, "")).toEqual(GROUPS);
    expect(filterGroupsByName(GROUPS, "   ")).toEqual(GROUPS);
  });

  it("matches a case-insensitive substring of the name", () => {
    expect(filterGroupsByName(GROUPS, "KITCH").map((g) => g.id)).toEqual(["g-2"]);
    expect(filterGroupsByName(GROUPS, "a").map((g) => g.id)).toEqual(["g-1", "g-3"]);
  });

  it("trims the query before matching", () => {
    expect(filterGroupsByName(GROUPS, "  blaine ").map((g) => g.id)).toEqual(["g-1"]);
  });

  it("returns nothing when no name matches", () => {
    expect(filterGroupsByName(GROUPS, "zzz")).toEqual([]);
  });

  it("does not hand back the caller's array", () => {
    expect(filterGroupsByName(GROUPS, "")).not.toBe(GROUPS);
  });
});

describe("chooseInitialGroupId", () => {
  const groupIds = GROUPS.map((g) => g.id);

  it("prefers a ?group= link that names a listed group", () => {
    expect(
      chooseInitialGroupId({ requestedGroupId: "g-2", headerWorkspaceId: "g-3", groupIds }),
    ).toBe("g-2");
  });

  it("ignores a ?group= link for a group that is not listed", () => {
    expect(
      chooseInitialGroupId({ requestedGroupId: "gone", headerWorkspaceId: "g-3", groupIds }),
    ).toBe("g-3");
  });

  it("falls back to the header's workspace when it is listed", () => {
    expect(
      chooseInitialGroupId({ requestedGroupId: null, headerWorkspaceId: "g-3", groupIds }),
    ).toBe("g-3");
  });

  /* An admin's groups list holds every team, the header only the teams they
   * are in; a header team that is not listed must not win. */
  it("falls back to the first group when the header's workspace is not listed", () => {
    expect(
      chooseInitialGroupId({ requestedGroupId: null, headerWorkspaceId: "other", groupIds }),
    ).toBe("g-1");
    expect(
      chooseInitialGroupId({ requestedGroupId: undefined, headerWorkspaceId: null, groupIds }),
    ).toBe("g-1");
  });

  it("returns null when there are no groups", () => {
    expect(
      chooseInitialGroupId({ requestedGroupId: "g-1", headerWorkspaceId: "g-1", groupIds: [] }),
    ).toBeNull();
  });
});

describe("searchWithGroup", () => {
  it("sets group and keeps the other params", () => {
    expect(searchWithGroup("tour=2&project=abc", "g-2")).toBe("tour=2&project=abc&group=g-2");
  });

  it("replaces an existing group", () => {
    expect(searchWithGroup("group=g-1", "g-2")).toBe("group=g-2");
  });

  it("drops tab, which would reopen the create view", () => {
    expect(searchWithGroup("tab=setup&group=g-1", "g-3")).toBe("group=g-3");
  });
});

describe("searchWithoutTab", () => {
  it("removes tab and keeps the rest", () => {
    expect(searchWithoutTab("tab=setup&group=g-1")).toBe("group=g-1");
    expect(searchWithoutTab("tab=setup")).toBe("");
  });
});

describe("repositoryCountText", () => {
  it("uses the singular only for one", () => {
    expect(repositoryCountText(0)).toBe("0 repositories");
    expect(repositoryCountText(1)).toBe("1 repository");
    expect(repositoryCountText(12)).toBe("12 repositories");
  });
});

describe("initialActiveIndex", () => {
  it("highlights the selected group when it is listed", () => {
    expect(initialActiveIndex(GROUPS, "g-3")).toBe(2);
  });

  it("highlights the first option otherwise, and none for an empty list", () => {
    expect(initialActiveIndex(GROUPS, "missing")).toBe(0);
    expect(initialActiveIndex(GROUPS, null)).toBe(0);
    expect(initialActiveIndex([], "g-1")).toBe(-1);
  });
});

describe("stepActiveIndex", () => {
  it("moves by one and clamps at both ends", () => {
    expect(stepActiveIndex(0, 1, 3)).toBe(1);
    expect(stepActiveIndex(2, 1, 3)).toBe(2);
    expect(stepActiveIndex(0, -1, 3)).toBe(0);
    expect(stepActiveIndex(-1, 1, 3)).toBe(0);
  });

  it("has nothing to move to in an empty list", () => {
    expect(stepActiveIndex(0, 1, 0)).toBe(-1);
  });
});

describe("createWorkspaceForGroup", () => {
  const workspaces = [{ id: "g-1" }, { id: "g-2" }];

  it("takes the group when the caller can create in it", () => {
    expect(createWorkspaceForGroup("g-2", workspaces, "g-1")).toBe("g-2");
  });

  /* An admin can view every team but creates only in their own. */
  it("keeps the current choice for a group the caller is not a member of", () => {
    expect(createWorkspaceForGroup("g-3", workspaces, "g-1")).toBe("g-1");
    expect(createWorkspaceForGroup("g-3", workspaces, null)).toBeNull();
  });

  it("takes the group while the caller's teams are still unknown", () => {
    expect(createWorkspaceForGroup("g-3", null, null)).toBe("g-3");
  });

  it("keeps the current choice when no group is shown", () => {
    expect(createWorkspaceForGroup(null, workspaces, "g-1")).toBe("g-1");
  });
});
