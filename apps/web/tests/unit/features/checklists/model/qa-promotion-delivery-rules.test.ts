import {
  blockingReasons,
  canOfferMerge,
  deliveredNote,
  mergeDisabledReason,
  mergeErrorRefreshesStatus,
  mergeErrorTitle,
  normalizePromotionMerge,
  normalizePromotionStatus,
  promotionChip,
  promotionMergeError,
  promotionTitle,
} from "../../../../../src/features/checklists/model/qa-promotion-rules";
import { poAcceptanceState } from "../../../../../src/features/checklists/model/po-studio-rules";
import { apiErrorWith, readyWire } from "../qa-promotion-fixtures";

const DELIVERED = {
  scope: "project",
  iterationDelivered: true,
  repositoryDelivered: true,
  iteration: { id: "it-3", number: 3, status: "delivered", deliveredAt: "2026-10-14T10:00:00.000Z" },
  eligible: false,
  reasons: ["Version 3 was delivered."],
};

describe("promotion status: the stored delivery state", () => {
  it("reads the new fields, and leaves them unknown on an older backend", () => {
    const status = normalizePromotionStatus(readyWire(DELIVERED));
    expect(status.iterationDelivered).toBe(true);
    expect(status.repositoryDelivered).toBe(true);
    expect(status.iteration).toEqual({ id: "it-3", number: 3, status: "delivered", deliveredAt: "2026-10-14T10:00:00.000Z" });
    const older = normalizePromotionStatus(readyWire());
    expect(older.iterationDelivered).toBe(false);
    expect(older.repositoryDelivered).toBeNull();
    expect(older.iteration).toBeNull();
  });

  it("names a delivered version instead of 'not ready', and nothing blocks it", () => {
    const status = normalizePromotionStatus(readyWire(DELIVERED));
    expect(promotionTitle(status)).toBe("Version 3 delivered");
    expect(promotionChip("ready", status)).toEqual({ tone: "delivered", label: "Version 3 delivered", short: "Delivered" });
    expect(blockingReasons(status)).toEqual([]);
    expect(deliveredNote(status, "en-GB")).toBe(
      "Version 3 delivered on 14 Oct 2026. Every repository's main holds the signed-off uat head.",
    );
    expect(poAcceptanceState({ scope: { kind: "project", deliveryProjectId: "dp", projectName: "P", projectHref: null }, promotionStatus: "ready", promotion: status })).toBe("delivered");
  });

  it("offers no Merge to main once delivered, whatever canMerge says", () => {
    const status = normalizePromotionStatus(readyWire({ ...DELIVERED, canMerge: true }));
    expect(canOfferMerge(status, "lead")).toBe(false);
    expect(canOfferMerge(normalizePromotionStatus(readyWire({ canMerge: true })), "lead")).toBe(true);
  });

  it("disables Merge from the server's repositoryDelivered, so a reload keeps it (P9)", () => {
    const merged = normalizePromotionStatus(readyWire({ repositoryDelivered: true }));
    expect(mergeDisabledReason(merged, null)).toBe("uat @ 9f8e7d6 is already merged into main.");
    // The server's explicit false wins over this page's memory.
    const notYet = normalizePromotionStatus(readyWire({ repositoryDelivered: false }));
    expect(mergeDisabledReason(notYet, notYet.headSha)).toBeNull();
    // An older backend: the in-memory flag, as before.
    const older = normalizePromotionStatus(readyWire());
    expect(mergeDisabledReason(older, older.headSha)).toBe("uat @ 9f8e7d6 is already merged into main.");
    expect(mergeDisabledReason(older, null)).toBeNull();
  });

  it("reads `already_in_main` on a merge reply as never an error", () => {
    expect(normalizePromotionMerge({ merged: false, how: "already_in_main", message: "main already contains this commit" })).toMatchObject({
      merged: false,
      alreadyInMain: true,
      message: "main already contains this commit",
    });
    expect(normalizePromotionMerge({ merged: true, how: "already_in_main" }).alreadyInMain).toBe(false);
  });
});

describe("promotion merge: the version codes", () => {
  it("maps ITERATION_DELIVERED and refreshes the status", () => {
    const error = promotionMergeError(apiErrorWith(409, { code: "ITERATION_DELIVERED", iterationNumber: 3 }));
    expect(error.kind).toBe("delivered");
    expect(error.message).toBe("Version 3 was delivered, so its requirements and QA are locked.");
    expect(mergeErrorTitle(error.kind)).toBe("Not merged — this version was already delivered");
    expect(mergeErrorRefreshesStatus(error)).toBe(true);
  });

  it("maps PROJECT_HAS_NO_REPOSITORIES", () => {
    const error = promotionMergeError(apiErrorWith(409, { code: "PROJECT_HAS_NO_REPOSITORIES" }));
    expect(error.kind).toBe("no_repositories");
    expect(error.message).toBe("This Project has no repositories yet, so there is nothing to merge to main. Add a repository first.");
    expect(mergeErrorTitle(error.kind)).toBe("Nothing to merge");
  });

  it("keeps QA_PROMOTION_BLOCKED as before: the server's sentence and reasons", () => {
    const error = promotionMergeError(apiErrorWith(409, { code: "QA_PROMOTION_BLOCKED", message: "Blocked.", reasons: ["Run is Conditional."] }));
    expect(error).toEqual({ kind: "blocked", message: "Blocked.", reasons: ["Run is Conditional."], signIn: false });
  });
});
