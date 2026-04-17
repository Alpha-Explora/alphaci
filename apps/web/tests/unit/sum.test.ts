import { sum } from "../../src/lib/sum";

describe("sum", () => {
  it("adds positive numbers", () => {
    expect(sum(2, 3)).toBe(5);
  });

  it("handles negative numbers", () => {
    expect(sum(-2, -3)).toBe(-5);
  });

  it("handles mixed signs", () => {
    expect(sum(-2, 3)).toBe(1);
  });
});
