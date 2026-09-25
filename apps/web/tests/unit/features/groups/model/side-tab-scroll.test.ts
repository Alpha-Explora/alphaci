import { revealScrollDelta } from "../../../../../src/features/groups/model/side-tab-scroll";

describe("revealScrollDelta", () => {
  const strip = { left: 0, right: 300 };

  it("does not move when the item is already visible", () => {
    expect(revealScrollDelta(strip, { left: 40, right: 140 })).toBe(0);
  });

  it("scrolls right to reveal an item past the right edge, with padding", () => {
    expect(revealScrollDelta(strip, { left: 320, right: 440 }, 12)).toBe(152);
  });

  it("scrolls left to reveal an item before the left edge, with padding", () => {
    expect(revealScrollDelta(strip, { left: -80, right: 20 }, 12)).toBe(-92);
  });
});
