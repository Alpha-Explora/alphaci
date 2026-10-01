import {
  OWN_TEAMS_HEADING,
  flattenSwitcherOptions,
  nextSwitcherIndex,
  openingSwitcherIndex,
  panelTabAction,
  switcherOptionGroups,
  switcherPanelShift,
} from "../../../../../../src/features/workspace/selection/model/workspace-switcher-rules";

const team = (id: string, name: string) => ({ id, name, kind: "team" as const, role: "member" as const });

const MINE = [team("t-1", "Team Blaine"), team("t-2", "Platform")];
const OTHERS = [team("t-5", "Johns Kitchen"), team("t-9", "Zeta")];

describe("switcherOptionGroups", () => {
  it("is one list under 'Your teams' when there are no other teams", () => {
    expect(switcherOptionGroups(MINE, [])).toEqual([
      { key: "own", label: OWN_TEAMS_HEADING, options: [MINE[1], MINE[0]] },
    ]);
  });

  it("merges an admin's other teams into the same single list, sorted by name", () => {
    const groups = switcherOptionGroups(MINE, OTHERS);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Your teams");
    expect(groups[0].options.map((option) => option.name)).toEqual([
      "Johns Kitchen",
      "Platform",
      "Team Blaine",
      "Zeta",
    ]);
  });

  it("sorts case-insensitively and breaks name ties by id", () => {
    const names = switcherOptionGroups(
      [team("b", "alpha"), team("a", "Alpha"), team("c", "beta")],
      [],
    )[0].options.map((option) => option.id);
    expect(names).toEqual(["a", "b", "c"]);
  });

  it("lists an admin in no team just the other teams, still under 'Your teams'", () => {
    const groups = switcherOptionGroups([], OTHERS);
    expect(groups.map((group) => group.label)).toEqual([OWN_TEAMS_HEADING]);
    expect(groups[0].options).toEqual(OTHERS);
  });

  it("does not mutate its inputs", () => {
    const own = [...MINE];
    switcherOptionGroups(own, OTHERS);
    expect(own).toEqual(MINE);
  });

  it("is empty with nothing to list", () => {
    expect(switcherOptionGroups([], [])).toEqual([]);
  });
});

describe("flattenSwitcherOptions", () => {
  /* The heading is not an option, so the arrow keys never land on it. */
  it("is every option in display (name) order", () => {
    expect(flattenSwitcherOptions(switcherOptionGroups(MINE, OTHERS)).map((option) => option.id)).toEqual([
      "t-5",
      "t-2",
      "t-1",
      "t-9",
    ]);
  });
});

describe("openingSwitcherIndex", () => {
  const options = flattenSwitcherOptions(switcherOptionGroups(MINE, OTHERS));

  it("opens on the current team", () => {
    expect(openingSwitcherIndex(options, "t-1")).toBe(2);
  });

  it("opens on the first team when the current one is not listed", () => {
    expect(openingSwitcherIndex(options, "gone")).toBe(0);
    expect(openingSwitcherIndex(options, null)).toBe(0);
  });
});

describe("nextSwitcherIndex", () => {
  it("moves down and up, wrapping at both ends", () => {
    expect(nextSwitcherIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextSwitcherIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextSwitcherIndex("ArrowUp", 1, 3)).toBe(0);
    expect(nextSwitcherIndex("ArrowUp", 0, 3)).toBe(2);
  });

  it("starts from the ends when nothing is active", () => {
    expect(nextSwitcherIndex("ArrowDown", -1, 3)).toBe(0);
    expect(nextSwitcherIndex("ArrowUp", -1, 3)).toBe(2);
  });

  it("jumps with Home and End", () => {
    expect(nextSwitcherIndex("Home", 2, 4)).toBe(0);
    expect(nextSwitcherIndex("End", 0, 4)).toBe(3);
  });

  it("ignores other keys and an empty list", () => {
    expect(nextSwitcherIndex("a", 1, 3)).toBeNull();
    expect(nextSwitcherIndex("Enter", 1, 3)).toBeNull();
    expect(nextSwitcherIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("panelTabAction", () => {
  it("hops from the list to the + button, then leaves", () => {
    expect(panelTabAction(false, false, true)).toBe("to-create");
    expect(panelTabAction(false, true, true)).toBe("close");
  });

  it("goes back from the + button to the list with Shift+Tab", () => {
    expect(panelTabAction(true, true, true)).toBe("to-list");
  });

  it("just leaves when there is no + button, or Shift+Tab from the list", () => {
    expect(panelTabAction(false, false, false)).toBe("close");
    expect(panelTabAction(true, false, true)).toBe("close");
  });
});

describe("switcherPanelShift", () => {
  it("leaves a panel that fits where it is", () => {
    expect(switcherPanelShift(150, 400, 1440)).toBe(0);
  });

  /* 390px phone: the trigger starts mid-header, a 320px panel would overflow. */
  it("slides a panel that runs off the right edge back on screen", () => {
    expect(switcherPanelShift(150, 470, 390)).toBe(-88);
  });

  it("never slides it past the left margin", () => {
    expect(switcherPanelShift(20, 420, 390, 8)).toBe(-12);
    expect(switcherPanelShift(4, 200, 390, 8)).toBe(4);
  });
});
