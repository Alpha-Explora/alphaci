import type {
  QaAutomatedResultWire,
  QaRunAutomationWire,
  QaStageAutomationWire,
} from "../../../../src/features/checklists/model/qa-automation-types";

export const RUN_URL = "https://github.com/tone/storefront-web/actions/runs/1234567890";

/** Verify failed: 2 of 20 browser/API tests failed, both listed. */
export function verifyFailure(overrides: Partial<QaStageAutomationWire> = {}): QaStageAutomationWire {
  return {
    stage: "verify",
    status: "failure",
    runId: 1234567890,
    runUrl: RUN_URL,
    reportedAt: "2026-09-25T06:57:00.000Z",
    tests: {
      total: 20,
      passed: 18,
      failed: 2,
      failures: [
        { name: "e2e/checkout.spec.ts › pays with a saved card", message: "Timed out 5000ms waiting for getByRole('button', { name: 'Pay' })" },
        { name: "e2e/cart.spec.ts › applies a coupon per line", message: "Expected ₱2,480, received ₱2,700" },
      ],
      failuresTruncated: false,
    },
    ...overrides,
  };
}

/** Quality passed: every unit test green. */
export function qualitySuccess(overrides: Partial<QaStageAutomationWire> = {}): QaStageAutomationWire {
  return {
    stage: "quality",
    status: "success",
    runId: 1234567001,
    runUrl: "https://github.com/tone/storefront-web/actions/runs/1234567001",
    reportedAt: "2026-09-25T06:50:00.000Z",
    tests: { total: 142, passed: 142, failed: 0, failures: [], failuresTruncated: false },
    ...overrides,
  };
}

export function automation(overrides: Partial<QaRunAutomationWire> = {}): QaRunAutomationWire {
  return { verify: verifyFailure(), quality: qualitySuccess(), ...overrides };
}

export function automated(overrides: Partial<QaAutomatedResultWire> = {}): QaAutomatedResultWire {
  return {
    source: "playwright",
    stage: "verify",
    status: "failed",
    scope: "spec",
    matchedSpec: "e2e/checkout.spec.ts",
    failure: { name: "e2e/checkout.spec.ts › pays with a saved card", message: "Timed out 5000ms" },
    runId: 1234567890,
    runUrl: RUN_URL,
    reportedAt: "2026-09-25T06:57:00.000Z",
    ...overrides,
  };
}
