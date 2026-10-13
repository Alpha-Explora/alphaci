import { plainFriendlyMessage } from "@/features/runs";
import { normalizeTestCases } from "@/features/runs/test-report";
import { failedTests } from "@/features/projects/detail/model/stage-result-figures";
import type { StageResults } from "@/shared/api/contracts";

const ESC = String.fromCharCode(27);
const dim = (text: string) => `${ESC}[2m${text}${ESC}[22m`;

describe("terminal colour codes never reach the page", () => {
  it("strips a friendly message's title, detail, hint and items", () => {
    const plain = plainFriendlyMessage({
      severity: "error",
      title: dim("2 tests failed"),
      detail: `${dim("expect(")}received${dim(")")}`,
      hint: dim("Run it locally"),
      items: [{ label: dim("cart.spec.ts"), sub: dim("line 4") }, { label: "plain" }],
    });
    expect(plain).toEqual({
      severity: "error",
      title: "2 tests failed",
      detail: "expect(received)",
      hint: "Run it locally",
      items: [{ label: "cart.spec.ts", sub: "line 4" }, { label: "plain" }],
    });
  });

  it("keeps a message without items as it was", () => {
    const message = { severity: "info" as const, title: "ok", detail: "", hint: "" };
    expect(plainFriendlyMessage(message)).toEqual({ ...message, items: undefined });
  });

  it("strips browser test records as they are read", () => {
    const [test] = normalizeTestCases([
      {
        title: "a.spec.ts > opens",
        status: "failed",
        steps: [{ title: dim("click"), failed: true }],
        error: { message: `${dim("expect(")}locator${dim(").toBeVisible()")}`, location: "a.spec.ts:3" },
      },
    ])!;
    expect(test?.error?.message).toBe("expect(locator).toBeVisible()");
    expect(test?.steps?.[0]?.title).toBe("click");
  });

  it("drops a record whose title is nothing but colour codes", () => {
    expect(normalizeTestCases([{ title: dim(""), status: "passed" }])).toEqual([]);
  });

  it("strips the failing test names and messages under a Tests figure", () => {
    const results = {
      tests: {
        total: 2,
        passed: 0,
        failed: 2,
        failures: [{ name: dim("cart"), message: dim("boom") }, { name: "home" }],
      },
    } as unknown as StageResults;
    expect(failedTests(results)).toEqual({
      failures: [{ name: "cart", message: "boom" }, { name: "home" }],
      more: 0,
    });
  });
});
