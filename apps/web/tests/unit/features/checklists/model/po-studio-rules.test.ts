import { poAcceptanceState, poWaitingText } from "../../../../../src/features/checklists/model/po-studio-rules";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import { normalizePromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-rules";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { promotionWire } from "../qa-promotion-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

const PROJECT: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "storefront", projectHref: null };

function run(overrides: Record<string, unknown> = {}) {
  return normalizeProjectRun(projectRunWire(overrides))!;
}

describe("poAcceptanceState", () => {
  it("waits for the Project and the promotion status", () => {
    expect(poAcceptanceState({ scope: { kind: "pending" }, promotionStatus: "ready", promotion: null })).toBe("loading");
    expect(poAcceptanceState({ scope: PROJECT, promotionStatus: "loading", promotion: null })).toBe("loading");
  });

  it("is ready only on the server's explicit eligible", () => {
    const ready = normalizePromotionStatus(promotionWire({ scope: "project", eligible: true }));
    const locked = normalizePromotionStatus(promotionWire({ scope: "project", eligible: false }));
    expect(poAcceptanceState({ scope: PROJECT, promotionStatus: "ready", promotion: ready })).toBe("ready");
    expect(poAcceptanceState({ scope: PROJECT, promotionStatus: "ready", promotion: locked })).toBe("waiting");
    expect(poAcceptanceState({ scope: PROJECT, promotionStatus: "error", promotion: null })).toBe("waiting");
  });

  it("has nothing to accept outside a Project", () => {
    const unfiled = normalizePromotionStatus(promotionWire({ scope: "unfiled" }));
    expect(poAcceptanceState({ scope: { kind: "repository" }, promotionStatus: "ready", promotion: null })).toBe("unfiled");
    expect(poAcceptanceState({ scope: PROJECT, promotionStatus: "ready", promotion: unfiled })).toBe("unfiled");
  });
});

describe("poWaitingText", () => {
  it("says what QA still has to do", () => {
    expect(poWaitingText(null)).toMatch(/^The QA Team has not started this Project's QA run yet\./);
    const open = run({ items: [runItemWire({ status: "passed" }), runItemWire({ id: "b", position: 1 }), runItemWire({ id: "c", position: 2 })] });
    expect(poWaitingText(open)).toMatch(/^1 of 3 items passed, 2 still with QA\./);
  });

  it("names a verdict that does not unlock, and a stale run", () => {
    const rejected = run({
      status: "signed_off",
      signoff: { id: "s1", verdict: "REJECTED", summary: null, conditions: null, signedBy: { id: "u", login: "ana-qa" }, signedAt: "2026-10-01T10:00:00Z" },
    });
    expect(poWaitingText(rejected)).toBe("QA signed this run off as Rejected. Only an Approved sign-off on the current uat heads unlocks the merge.");
    expect(poWaitingText(run({ stale: true }))).toMatch(/^uat moved since this run started/);
  });
});
