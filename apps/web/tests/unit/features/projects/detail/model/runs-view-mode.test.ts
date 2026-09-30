import { runsViewModeFor } from "../../../../../../src/features/projects/detail/model/runs-view-mode";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

describe("runsViewModeFor", () => {
  it.each<[AppRole, "deep" | "summary"]>([
    ["member", "deep"],
    ["lead", "summary"],
    ["qa", "summary"],
    ["admin", "summary"],
  ])("%s gets the %s view", (role, mode) => {
    expect(runsViewModeFor(role)).toBe(mode);
  });

  it("gives an unknown, missing or not-yet-loaded role the summary", () => {
    expect(runsViewModeFor(undefined)).toBe("summary");
    expect(runsViewModeFor(null)).toBe("summary");
    expect(runsViewModeFor("superuser" as AppRole)).toBe("summary");
  });
});
