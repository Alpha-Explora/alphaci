import {
  OWN_TEAMS_HEADING,
  flattenSwitcherOptions,
  nextSwitcherIndex,
  openingSwitcherIndex,
  switcherOptionGroups,
  switcherPanelShift,
} from "../../../../../../src/features/workspace/selection/model/workspace-switcher-rules";

const team = (id: string, name: string) => ({ id, name, kind: "team" as const, role: "member" as const });

const MINE = [team("t-1", "Team Blaine"), team("t-2", "Platform")];
const OTHERS = [team("t-5", "Johns Kitchen"), team("t-9", "Zeta")];

describe("switcherOptionGroups", () => {
  it("is one flat, unheaded list when there are no other teams", () => {
    expect(switcherOptionGroups(MINE, [])).toEqual([{ key: "own", label: null, options: MINE }]);
  });

  it("heads an admin's own teams, then their other teams", () => {
    const groups = switcherOptionGroups(MINE, OTHERS);
    expect(groups.map((group) => group.label)).toEqual([OWN_TEAMS_HEADING, "Other teams (admin)"]);
    expect(groups[1].options).toBe(OTHERS);
  });

  it("drops the empty own group for an admin in no team", () => {
    expect(switcherOptionGroups([], OTHERS).map((group) => group.key)).toEqual(["other"]);
  });

  it("is empty with nothing to list", () => {
    expect(switcherOptionGroups([], [])).toEqual([]);
  });
});

describe("flattenSwitcherOptions", () => {
  /* Group headings are not options, so the arrow keys never land on one. */
  it("is every option in display order, headings left out", () => {
    expect(flattenSwitcherOptions(switcherOptionGroups(MINE, OTHERS)).map((option) => option.id)).toEqual([
      "t-1",
      "t-2",
      "t-5",
      "t-9",
    ]);
  });
});

describe("openingSwitcherIndex", () => {
  const options = flattenSwitcherOptions(switcherOptionGroups(MINE, OTHERS));

  it("opens on the current team", () => {
    expect(openingSwitcherIndex(options, "t-5")).toBe(2);
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
