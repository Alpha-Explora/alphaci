import {
  approvedCountLabel,
  blockingReasons,
  canOfferMerge,
  mergeConfirmText,
  mergeDisabledReason,
  mergeErrorClosesDialog,
  mergeErrorRefreshesStatus,
  mergeErrorTitle,
  mergedLabel,
  normalizePromotionMerge,
  normalizePromotionStatus,
  promotionChecklistState,
  promotionChip,
  promotionMergeError,
  promotionRoute,
  promotionTitle,
  roleCanMerge,
} from "../../../../../src/features/checklists/model/qa-promotion-rules";
import type { QaPromotionChecklist } from "../../../../../src/features/checklists/model/qa-promotion-types";
import { apiErrorWith, HEAD_SHA, promotionWire, readyWire } from "../qa-promotion-fixtures";

function checklist(overrides: Partial<QaPromotionChecklist> = {}): QaPromotionChecklist {
  return { id: "cl-1", name: "Smoke", runId: "run-1", verdict: null, runStatus: "open", approvedForHead: false, ...overrides };
}

describe("normalizePromotionStatus", () => {
  it("reads the contract as sent", () => {
    const status = normalizePromotionStatus(promotionWire());
    expect(status).toEqual({
      qaBranch: "uat",
      targetBranch: "main",
      headSha: HEAD_SHA,
      checklists: [
        { id: "cl-1", name: "Release smoke test", runId: "run-1", verdict: "APPROVED", runStatus: "signed_off", approvedForHead: true },
        { id: "cl-2", name: "Accessibility pass", runId: null, verdict: null, runStatus: null, approvedForHead: false },
      ],
      eligible: false,
      reasons: ["Accessibility pass has no QA run on uat @ 9f8e7d6."],
      pullRequest: { number: 42, url: "https://github.com/tone/storefront-web/pull/42", headSha: HEAD_SHA },
      canMerge: true,
      scope: null,
      deliveryProject: null,
      run: null,
      repositories: [],
      requirementsChanged: false,
      repositoryDelivered: null,
      iterationDelivered: false,
      iteration: null,
    });
  });

  it.each([undefined, null, "nope", 42, []])("degrades %p to a not-ready, read-only status", (input) => {
    expect(normalizePromotionStatus(input)).toEqual({
      qaBranch: "uat",
      targetBranch: "main",
      headSha: null,
      checklists: [],
      eligible: false,
      reasons: [],
      pullRequest: null,
      canMerge: false,
      scope: null,
      deliveryProject: null,
      run: null,
      repositories: [],
      requirementsChanged: false,
      repositoryDelivered: null,
      iterationDelivered: false,
      iteration: null,
    });
  });

  it("never reads a truthy non-boolean as eligible or mergeable", () => {
    const status = normalizePromotionStatus(readyWire({ eligible: "true", canMerge: 1 }));
    expect(status.eligible).toBe(false);
    expect(status.canMerge).toBe(false);
  });

  it("drops broken rows, unknown verdicts and anything but https PR links", () => {
    const status = normalizePromotionStatus(
      promotionWire({
        checklists: [
          { id: "", name: "no id" },
          "junk",
          { id: "cl-9", verdict: "MAYBE", runStatus: "paused", approvedForHead: "yes" },
        ],
        reasons: ["  ", 7, " Real reason "],
        pullRequest: { number: 42, url: "javascript:alert(1)" },
      }),
    );
    expect(status.checklists).toEqual([
      { id: "cl-9", name: "Untitled checklist", runId: null, verdict: null, runStatus: null, approvedForHead: false },
    ]);
    expect(status.reasons).toEqual(["Real reason"]);
    expect(status.pullRequest).toBeNull();
    expect(normalizePromotionStatus(promotionWire({ pullRequest: { number: 0, url: "https://github.com/x/y/pull/0" } })).pullRequest).toBeNull();
  });
});

describe("normalizePromotionMerge", () => {
  it("reads a merge", () => {
    expect(
      normalizePromotionMerge({ merged: true, sha: "abc1234ffff", message: "Pull Request successfully merged", pullRequest: { number: 42, url: "https://github.com/t/s/pull/42" } }),
    ).toEqual({ merged: true, sha: "abc1234ffff", message: "Pull Request successfully merged", pullRequest: { number: 42, url: "https://github.com/t/s/pull/42" }, alreadyInMain: false });
  });

  it("keeps GitHub's refusal text verbatim", () => {
    const result = normalizePromotionMerge({ merged: false, sha: null, message: "At least 1 approving review is required by reviewers with write access.", pullRequest: { number: 42, url: "https://github.com/t/s/pull/42" } });
    expect(result.merged).toBe(false);
    expect(result.message).toBe("At least 1 approving review is required by reviewers with write access.");
  });

  it("never claims a merge from a partial reply, and never shows a sha for a refusal", () => {
    expect(normalizePromotionMerge(undefined)).toEqual({
      merged: false,
      sha: null,
      message: "GitHub did not merge the pull request and gave no reason.",
      pullRequest: null,
      alreadyInMain: false,
    });
    expect(normalizePromotionMerge({ merged: "true", sha: "abc" }).merged).toBe(false);
    expect(normalizePromotionMerge({ merged: false, sha: "abc" }).sha).toBeNull();
    expect(normalizePromotionMerge({ merged: true }).message).toBe("Merged into main.");
  });
});

describe("promotionChip", () => {
  it("is green and \"Ready\" once the server says eligible", () => {
    expect(promotionChip("ready", { eligible: true })).toEqual({ tone: "ready", label: "Ready for production", short: "Ready" });
  });

  it("is amber and \"Not ready\" while it is not", () => {
    expect(promotionChip("ready", { eligible: false })).toEqual({
      tone: "blocked",
      label: "Not ready for production",
      short: "Not ready",
    });
  });

  it("is grey while loading or unreadable, and keeps the last answer during a refresh", () => {
    expect(promotionChip("loading", null)).toEqual({ tone: "unknown", label: "Checking production readiness", short: "Checking" });
    expect(promotionChip("error", null)).toEqual({ tone: "unknown", label: "Production readiness unknown", short: "Unknown" });
    expect(promotionChip("loading", { eligible: true }).tone).toBe("ready");
  });

  it("never reads ready from anything but the server's exact true", () => {
    expect(promotionChip("ready", normalizePromotionStatus({ eligible: "true" })).tone).toBe("blocked");
  });
});

describe("labels", () => {
  it("titles, route and approved count", () => {
    const status = normalizePromotionStatus(promotionWire());
    expect(promotionTitle(status)).toBe("Not ready for production");
    expect(promotionTitle({ eligible: true })).toBe("Ready for production");
    expect(promotionRoute(status)).toBe("uat @ 9f8e7d6 → main");
    expect(promotionRoute({ ...status, headSha: null })).toBe("uat → main");
    expect(approvedCountLabel(status)).toBe("1 of 2 checklists approved");
    expect(approvedCountLabel({ checklists: [checklist({ approvedForHead: true })] })).toBe("1 of 1 checklist approved");
    expect(approvedCountLabel({ checklists: [] })).toBe("No checklist shared");
  });

  it.each([
    [checklist({ approvedForHead: true, verdict: "APPROVED", runStatus: "signed_off" }), "success", "Approved for this commit", true],
    [checklist({ runId: null, runStatus: null }), "neutral", "Not verified on this commit yet", false],
    [checklist({ runStatus: "open" }), "brand", "Run in progress — not signed off yet", false],
    [checklist({ runStatus: "signed_off", verdict: "REJECTED" }), "danger", "Signed off Rejected", false],
    [checklist({ runStatus: "signed_off", verdict: "CONDITIONAL" }), "warning", "Conditional — main needs Approved", false],
    [checklist({ runStatus: "signed_off", verdict: "APPROVED" }), "warning", "Approved, but not for this commit", false],
  ])("checklist row %#", (entry, tone, label, approved) => {
    expect(promotionChecklistState(entry)).toEqual({ tone, label, approved });
  });

  it("uses the server's reasons, and still gives the rule when it sends none", () => {
    const status = normalizePromotionStatus(promotionWire());
    expect(blockingReasons(status)).toEqual(["Accessibility pass has no QA run on uat @ 9f8e7d6."]);
    expect(blockingReasons({ ...status, reasons: [] })).toEqual([
      "Every shared checklist must be signed off Approved on uat's current commit.",
    ]);
    expect(blockingReasons({ ...status, reasons: [], checklists: [] })).toEqual([
      "No QA checklist is shared with this project yet.",
    ]);
    expect(blockingReasons({ ...status, eligible: true })).toEqual([]);
  });
});

describe("who may merge, and when", () => {
  it("needs the server's canMerge AND a lead or admin role", () => {
    expect(roleCanMerge("lead")).toBe(true);
    expect(roleCanMerge("admin")).toBe(true);
    expect(roleCanMerge("qa")).toBe(false);
    expect(roleCanMerge("member")).toBe(false);
    expect(roleCanMerge(null)).toBe(false);
    expect(canOfferMerge({ canMerge: true }, "lead")).toBe(true);
    expect(canOfferMerge({ canMerge: false }, "lead")).toBe(false);
    expect(canOfferMerge({ canMerge: true }, "qa")).toBe(false);
  });

  it("explains a disabled button", () => {
    const ready = normalizePromotionStatus(readyWire());
    expect(mergeDisabledReason(ready, null)).toBeNull();
    expect(mergeDisabledReason({ ...ready, eligible: false }, null)).toBe(
      "Merging opens once every shared checklist is signed off Approved on uat @ 9f8e7d6.",
    );
    expect(mergeDisabledReason({ ...ready, headSha: null }, null)).toBe("uat's current commit could not be resolved.");
    expect(mergeDisabledReason(ready, HEAD_SHA)).toBe("uat @ 9f8e7d6 is already merged into main.");
    expect(mergeDisabledReason(ready, "some-older-sha")).toBeNull();
  });

  it("names the project, commit and pull request in the confirmation", () => {
    const ready = normalizePromotionStatus(readyWire());
    expect(mergeConfirmText(ready, "tone/storefront-web")).toBe(
      "Merge tone/storefront-web uat @ 9f8e7d6 into main through pull request #42, with your GitHub account.",
    );
    expect(mergeConfirmText({ ...ready, pullRequest: null }, "tone/storefront-web")).toBe(
      "Merge tone/storefront-web uat @ 9f8e7d6 into main through a new uat → main pull request, with your GitHub account.",
    );
  });

  it("labels a merge with its merge commit", () => {
    expect(mergedLabel({ sha: "abc1234ffff" }, "main")).toBe("main updated · merge commit abc1234");
    expect(mergedLabel({ sha: null }, "main")).toBe("main updated");
  });
});

describe("promotionMergeError", () => {
  it("QA_PROMOTION_BLOCKED carries the server's message and reasons, and refreshes", () => {
    const error = promotionMergeError(
      apiErrorWith(409, { code: "QA_PROMOTION_BLOCKED", message: "QA has not approved uat.", reasons: ["Smoke is Rejected.", 4] }),
    );
    expect(error).toEqual({ kind: "blocked", message: "QA has not approved uat.", reasons: ["Smoke is Rejected."], signIn: false });
    expect(mergeErrorRefreshesStatus(error)).toBe(true);
    expect(mergeErrorClosesDialog(error)).toBe(true);
    expect(mergeErrorTitle(error.kind)).toBe("Not merged — QA approval is incomplete");
  });

  it("QA_UAT_MOVED explains that uat changed since sign-off, and refreshes", () => {
    const error = promotionMergeError(apiErrorWith(409, { code: "QA_UAT_MOVED", message: "head moved" }));
    expect(error.kind).toBe("moved");
    expect(error.message).toContain("uat moved after QA signed off");
    expect(mergeErrorRefreshesStatus(error)).toBe(true);
    expect(mergeErrorTitle("moved")).toBe("Not merged — uat moved since sign-off");
  });

  it("GITHUB_REAUTH (also nested under details.error) and 401 ask to sign in again", () => {
    expect(promotionMergeError(apiErrorWith(409, { code: "GITHUB_REAUTH" }))).toMatchObject({ kind: "reauth", signIn: true });
    expect(promotionMergeError(apiErrorWith(401, { error: { code: "github_reauth" } }))).toMatchObject({ kind: "reauth", signIn: true });
    expect(promotionMergeError(apiErrorWith(401)).message).toBe("Your session has ended. Sign in again to merge.");
    expect(mergeErrorRefreshesStatus({ kind: "reauth" })).toBe(false);
  });

  it("403 and 404 have their own copy; anything else keeps the dialog open to retry", () => {
    expect(promotionMergeError(apiErrorWith(403)).message).toBe("Only a Product owner or admin can merge uat into main.");
    expect(promotionMergeError(apiErrorWith(404)).kind).toBe("not_found");
    const failed = promotionMergeError(new Error("network"));
    expect(failed).toEqual({ kind: "failed", message: "The merge could not be completed. Try again in a moment.", reasons: [], signIn: false });
    expect(mergeErrorClosesDialog(failed)).toBe(false);
    expect(promotionMergeError(apiErrorWith(502, { message: "GitHub is unavailable." })).message).toBe("GitHub is unavailable.");
  });
});
