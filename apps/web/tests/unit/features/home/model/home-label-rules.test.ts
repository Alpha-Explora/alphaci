import {
  countLabel,
  defectSegments,
  mergedLabel,
  runStatusBadge,
  segmentSummary,
  segmentTotal,
  signedOffLine,
  testsLabel,
  verdictBadge,
  verificationSegments,
  verifyStatusLabel,
  verifyTone,
} from "../../../../../src/features/home/model/home-label-rules";

describe("Home role labels", () => {
  it("counts in words", () => {
    expect(countLabel(1, "item", "items")).toBe("1 item");
    expect(countLabel(3, "item", "items")).toBe("3 items");
  });

  it("badges a run by its state, then its verdict", () => {
    expect(runStatusBadge("open", null)).toEqual({ label: "Open", tone: "warn" });
    expect(runStatusBadge("signed_off", "APPROVED")).toEqual({ label: "Approved", tone: "ok" });
    expect(runStatusBadge("signed_off", "REJECTED")).toEqual({ label: "Rejected", tone: "danger" });
    expect(runStatusBadge("signed_off", null)).toEqual({ label: "Signed off", tone: "muted" });
    expect(verdictBadge("CONDITIONAL")).toEqual({ label: "Conditional", tone: "warn" });
  });

  it("summarises verification and defects, leaving out zeros", () => {
    const verification = verificationSegments({ pending: 2, passed: 5, failed: 1, blocked: 0, returned_to_dev: 0 });
    expect(segmentSummary(verification, "none")).toBe("5 passed · 1 failed · 2 pending");
    expect(segmentTotal(verification)).toBe(8);
    const defects = defectSegments({ blocker: 0, major: 0, minor: 0, unrated: 0 });
    expect(segmentSummary(defects, "No open defects")).toBe("No open defects");
    expect(defects.map((segment) => segment.key)).toEqual(["blocker", "major", "minor", "unrated"]);
  });

  it("names the verify stage of a uat run", () => {
    expect(verifyStatusLabel("success")).toBe("Verify passed");
    expect(verifyStatusLabel("failure")).toBe("Verify failed");
    expect(verifyStatusLabel("blocked")).toBe("Verify not run");
    expect(verifyTone("success")).toBe("ok");
    expect(verifyTone("failure")).toBe("danger");
    expect(verifyTone("running")).toBe("warn");
    expect(verifyTone("pending")).toBe("muted");
  });

  it("counts tests only when the stage reported some", () => {
    expect(testsLabel({ passed: 48, failed: 2, total: 50 })).toBe("48 of 50 tests passed");
    expect(testsLabel({ passed: 0, failed: 0, total: 0 })).toBeNull();
    expect(testsLabel(null)).toBeNull();
  });

  it("says who signed off and when, with what the server sent", () => {
    const now = new Date("2026-10-13T12:00:00Z").getTime();
    expect(signedOffLine({ signedOffBy: "ana", signedOffAt: "2026-10-11T12:00:00Z" }, now)).toBe("Signed off by ana · 2d ago");
    expect(signedOffLine({ signedOffBy: null, signedOffAt: null })).toBe("Signed off");
    expect(mergedLabel({ mergedRepositories: 1, totalRepositories: 2 })).toBe("1 of 2 repositories merged");
    expect(mergedLabel({ mergedRepositories: 0, totalRepositories: 1 })).toBe("0 of 1 repository merged");
  });
});
