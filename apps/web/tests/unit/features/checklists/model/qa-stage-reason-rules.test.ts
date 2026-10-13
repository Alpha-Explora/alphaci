import {
  normalizeFailure,
  normalizeRunAutomation,
  stageMissingLine,
  stageNoCountsLine,
} from "../../../../../src/features/checklists/model/qa-automation-rules";
import type { QaStageResult } from "../../../../../src/features/checklists/model/qa-automation-types";

const ESC = String.fromCharCode(27);

function quality(status: QaStageResult["status"], reason?: string): QaStageResult {
  return { stage: "quality", status, runId: null, runUrl: null, reportedAt: null, tests: null, ...(reason ? { reason } : {}) };
}

describe("a stage's reason, as read from the wire", () => {
  it("takes the first error message's title, colour codes removed", () => {
    const { verify } = normalizeRunAutomation({
      verify: {
        status: "failure",
        friendlyMessages: [
          { severity: "warning", title: "Slow suite" },
          { severity: "error", title: `${ESC}[2m  Server never answered ${ESC}[22m` },
        ],
      },
    });
    expect(verify?.reason).toBe("Server never answered");
  });

  it("falls back to the first message, its detail, then a plain reason", () => {
    expect(normalizeRunAutomation({ verify: { friendlyMessages: [{ severity: "info", title: "Skipped" }] } }).verify?.reason).toBe("Skipped");
    expect(normalizeRunAutomation({ verify: { friendlyMessages: [{ title: " ", detail: "Detail only" }] } }).verify?.reason).toBe("Detail only");
    expect(normalizeRunAutomation({ verify: { reason: "Deploy failed" } }).verify?.reason).toBe("Deploy failed");
  });

  it("leaves the reason out when the server sent none, or nothing usable", () => {
    expect(normalizeRunAutomation({ verify: { status: "failure" } }).verify).not.toHaveProperty("reason");
    expect(normalizeRunAutomation({ verify: { friendlyMessages: "nope", reason: 4 } }).verify).not.toHaveProperty("reason");
    expect(normalizeRunAutomation({ verify: { friendlyMessages: [null, "x", { title: "" }] } }).verify).not.toHaveProperty("reason");
  });

  it("strips colour codes from listed failures", () => {
    expect(normalizeFailure({ name: `${ESC}[1mcart${ESC}[22m`, message: `${ESC}[31mboom${ESC}[39m` })).toEqual({
      name: "cart",
      message: "boom",
    });
  });
});

describe("stageNoCountsLine", () => {
  it("shows a failed stage's reason", () => {
    expect(stageNoCountsLine({ status: "failure", reason: "Gate failed" })).toEqual({ text: "Gate failed", isReason: true });
  });

  it("keeps the plain line otherwise", () => {
    expect(stageNoCountsLine({ status: "failure" })).toEqual({ text: "No test counts reported", isReason: false });
    expect(stageNoCountsLine({ status: "success", reason: "ok" })).toEqual({ text: "No test counts reported", isReason: false });
  });
});

describe("stageMissingLine", () => {
  it("blames a failed Quality for a missing Verify, with its reason when known", () => {
    expect(stageMissingLine("verify", "abcdef1234", quality("failure", "Lint errors"))).toBe(
      "Not run: Quality failed on abcdef1 first (Lint errors)",
    );
    expect(stageMissingLine("verify", null, quality("failure"))).toBe("Not run: Quality failed first");
  });

  it("says not reported yet when nothing upstream failed, or for Quality itself", () => {
    expect(stageMissingLine("verify", "abcdef1234", quality("success"))).toBe("Not reported for abcdef1 yet");
    expect(stageMissingLine("verify", null, null)).toBe("Not reported yet");
    expect(stageMissingLine("quality", "abcdef1234", quality("failure"))).toBe("Not reported for abcdef1 yet");
  });
});
