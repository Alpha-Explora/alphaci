import { CHECKLIST_VIEW_LABELS, checklistViewFor } from "../../../../../src/features/checklists/model/checklist-view-rules";

describe("checklistViewFor (one view per persona)", () => {
  it("gives the Product owner and an admin the requirements they write", () => {
    expect(checklistViewFor("lead")).toBe("author");
    expect(checklistViewFor("admin")).toBe("author");
  });

  it("gives a Developer the items it moves, and the QA Team the run it verifies", () => {
    expect(checklistViewFor("member")).toBe("developer");
    expect(checklistViewFor("qa")).toBe("qa");
  });

  it("gives an unknown or missing role the Developer's view, never an author's or a verifier's", () => {
    expect(checklistViewFor(null)).toBe("developer");
    expect(checklistViewFor(undefined)).toBe("developer");
    expect(checklistViewFor("auditor" as never)).toBe("developer");
  });

  it("names each view for the work it holds", () => {
    expect(CHECKLIST_VIEW_LABELS).toEqual({ author: "Requirements", developer: "Checklist", qa: "QA testing" });
  });
});
