import {
  evidenceMatchesHead,
  visualEvidenceOf,
} from "../../../../../../src/features/projects/detail/model/visual-evidence-rules";
import { EVIDENCE_SHA, MIXED, NOTHING_REPORTED, shot, visualResponse } from "../visual-evidence-fixtures";

describe("visualEvidenceOf", () => {
  it("shows the changed screenshots first, then the new ones, and only names the ones that matched", () => {
    const evidence = visualEvidenceOf(visualResponse(MIXED), EVIDENCE_SHA);
    expect(evidence?.shown.map((snapshot) => snapshot.name)).toEqual(["home-desktop.png", "cart-mobile.png"]);
    expect(evidence?.matched).toEqual(["login-desktop.png"]);
  });

  it("counts the images the section will ask the browser for, so the page knows when they are in", () => {
    // changed: reference + new + diff, new: new only (no reference), matched: none shown.
    expect(visualEvidenceOf(visualResponse(MIXED), EVIDENCE_SHA)?.imageCount).toBe(4);
  });

  it("headlines the counts", () => {
    expect(visualEvidenceOf(visualResponse(MIXED), EVIDENCE_SHA)?.header).toBe(
      "Visual checks · 1 changed · 1 new · 1 unchanged",
    );
  });

  it("draws no pictures when everything matched, but still says so", () => {
    const evidence = visualEvidenceOf(visualResponse([shot("a.png", "passed"), shot("b.png", "passed")]), EVIDENCE_SHA);
    expect(evidence?.shown).toEqual([]);
    expect(evidence?.imageCount).toBe(0);
    expect(evidence?.matched).toEqual(["a.png", "b.png"]);
  });

  it("is null when the latest run reported nothing, or no run reported at all", () => {
    expect(visualEvidenceOf(NOTHING_REPORTED, EVIDENCE_SHA)).toBeNull();
    expect(visualEvidenceOf(visualResponse([]), EVIDENCE_SHA)).toBeNull();
  });

  it("says whose screenshots these are", () => {
    expect(visualEvidenceOf(visualResponse(MIXED), EVIDENCE_SHA)?.provenance).toBe(
      "Latest Verify run on uat, commit a1b2c3d.",
    );
  });

  it("warns when uat has moved past the head the report covers", () => {
    const evidence = visualEvidenceOf(visualResponse(MIXED), "ffffeeee00001111");
    expect(evidence?.provenance).toContain("commit a1b2c3d");
    expect(evidence?.provenance).toContain("uat has moved since this run started");
  });

  it("does not warn when the head is unknown", () => {
    expect(visualEvidenceOf(visualResponse(MIXED), null)?.provenance).toBe("Latest Verify run on uat, commit a1b2c3d.");
  });
});

describe("evidenceMatchesHead", () => {
  it("compares the short prefix, so a short and a full sha of the same commit match", () => {
    expect(evidenceMatchesHead(EVIDENCE_SHA, "a1b2c3d")).toBe(true);
    expect(evidenceMatchesHead("a1b2c3d", EVIDENCE_SHA)).toBe(true);
  });

  it("is false for a different commit, and null when either side is unknown", () => {
    expect(evidenceMatchesHead(EVIDENCE_SHA, "9999999")).toBe(false);
    expect(evidenceMatchesHead(EVIDENCE_SHA, null)).toBeNull();
    expect(evidenceMatchesHead("", "a1b2c3d")).toBeNull();
  });
});
