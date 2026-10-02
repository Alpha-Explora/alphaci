import { canManageHosting } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

/* Developers and admins change hosting; Product owners and QA read it. */
describe("canManageHosting", () => {
  it.each([
    ["admin", true],
    ["member", true],
    ["lead", false],
    ["qa", false],
    [null, false],
    [undefined, false],
  ] as const)("%s -> %s", (role, expected) => {
    expect(canManageHosting(role)).toBe(expected);
  });
});
