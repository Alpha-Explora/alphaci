import { canManageHosting } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

describe("canManageHosting", () => {
  it.each([
    ["admin", true],
    ["lead", true],
    ["member", false],
    ["qa", false],
    [null, false],
    [undefined, false],
  ] as const)("%s -> %s", (role, expected) => {
    expect(canManageHosting(role)).toBe(expected);
  });
});
