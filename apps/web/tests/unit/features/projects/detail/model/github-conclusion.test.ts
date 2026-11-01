import { isFailedConclusion } from "@/features/projects/detail/model/github-conclusion";
import { ciRunRowClass } from "@/features/projects/detail/model/project-detail-tab-rules";
import { statusTone } from "@/features/projects/detail/views/workspace/workspace-states";
import { checkTone } from "@/features/runs";

describe("isFailedConclusion", () => {
  it("counts failure, timed_out and startup_failure as failed", () => {
    expect(isFailedConclusion("failure")).toBe(true);
    expect(isFailedConclusion("timed_out")).toBe(true);
    expect(isFailedConclusion("startup_failure")).toBe(true);
  });

  it("does not count a pass, a skip, a cancel or a run still going", () => {
    for (const conclusion of ["success", "skipped", "cancelled", "neutral", null, undefined]) {
      expect(isFailedConclusion(conclusion)).toBe(false);
    }
  });
});

describe("startup_failure is red wherever a GitHub conclusion becomes a tone", () => {
  it("paints the workflow run row and its steps red", () => {
    expect(statusTone("completed", "startup_failure")).toBe("failure");
    expect(statusTone("completed", "timed_out")).toBe("failure");
    expect(statusTone("completed", "skipped")).toBe("neutral");
  });

  it("marks the CI run list row failed", () => {
    expect(ciRunRowClass("startup_failure")).toBe("failed");
    expect(ciRunRowClass("timed_out")).toBe("failed");
    expect(ciRunRowClass("success")).toBe("provisioned");
  });

  it("reads a tool check GitHub never started as failed", () => {
    expect(checkTone("startup_failure")).toBe("failed");
  });
});
