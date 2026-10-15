import { checklistErrorMessage, checklistOwningProjectId, backendHasProjectRequirements, isStaleConflict, projectRequirementsHref } from "../../../../../src/features/checklists/model/checklist-rules";
import { isStaleCode, QA_ERROR_MESSAGES, qaCodeMessage } from "../../../../../src/features/checklists/model/qa-error-messages";
import {
  approvedCountLabel,
  blockingReasons,
  mergeDisabledReason,
  mergeErrorClosesDialog,
  mergeErrorRefreshesStatus,
  mergeErrorTitle,
  normalizePromotionStatus,
  promotionMergeError,
  promotionRunState,
  UNFILED_REASON,
} from "../../../../../src/features/checklists/model/qa-promotion-rules";
import { lockLegacyRun, qaActionError } from "../../../../../src/features/checklists/model/qa-run-rules";
import { qaScopeFromFolder, REPOSITORY_SCOPE, withProjectOnPage } from "../../../../../src/features/checklists/model/qa-scope";
import { apiErrorWith, HEAD_SHA, promotionWire } from "../qa-promotion-fixtures";
import { qaRun } from "../qa-run-fixtures";
import { headWire, SHA_BE_NEW } from "../requirement-fixtures";

describe("error codes (product sentences)", () => {
  it.each([
    "QA_NO_REQUIREMENTS",
    "QA_UAT_HEAD_UNREADABLE",
    "QA_RUN_LEGACY_READONLY",
    "REQUIREMENT_MOVED_TO_PROJECT",
    "QA_PROJECT_REQUIRED",
    "QA_PROGRESS_NOT_DONE",
    "QA_VERIFICATION_STATUS_INVALID",
    "VERIFICATION_FORBIDDEN",
  ])("maps %s to a sentence", (code) => {
    expect(qaCodeMessage(apiErrorWith(409, { code }))).toBe(QA_ERROR_MESSAGES[code]);
    expect(qaCodeMessage(apiErrorWith(409, { code: code.toLowerCase() }))).toBe(QA_ERROR_MESSAGES[code]);
  });

  it("names the unreadable repositories and leaves unknown codes to the caller", () => {
    expect(qaCodeMessage(apiErrorWith(409, { code: "QA_UAT_HEAD_UNREADABLE", reasons: ['Could not read the uat head of "web"'] }))).toBe(
      `${QA_ERROR_MESSAGES.QA_UAT_HEAD_UNREADABLE} Could not read the uat head of "web"`,
    );
    expect(qaCodeMessage(apiErrorWith(409, { code: "SOMETHING_ELSE" }))).toBeNull();
    expect(qaCodeMessage(apiErrorWith(409, { error: { code: "QA_PROGRESS_NOT_DONE" } }))).toBe(QA_ERROR_MESSAGES.QA_PROGRESS_NOT_DONE);
    expect(isStaleCode(apiErrorWith(409, { code: "QA_ITEM_STALE" }))).toBe(true);
    expect(isStaleCode(apiErrorWith(409, { code: "QA_NO_REQUIREMENTS" }))).toBe(false);
  });

  it("explains an Approved sign-off refused for items the run lacked, and offers a reload to see them", () => {
    const refused = apiErrorWith(409, { code: "QA_RUN_MISSING_ITEMS", missingItems: 2, message: "raw" });
    expect(qaActionError(refused, "x")).toEqual({
      message:
        "Requirement items were added after this run started, so QA has not verified them. They are now in the run as Pending: reload the run, verify them, then sign off.",
      stale: true,
    });
  });

  it("uses the sentences on the legacy run and checklist screens too", () => {
    expect(qaActionError(apiErrorWith(409, { code: "QA_RUN_LEGACY_READONLY", message: "raw" }), "x")).toEqual({
      message: QA_ERROR_MESSAGES.QA_RUN_LEGACY_READONLY,
      stale: false,
    });
    const moved = apiErrorWith(409, { code: "REQUIREMENT_MOVED_TO_PROJECT" });
    expect(checklistErrorMessage(moved, "x")).toBe(QA_ERROR_MESSAGES.REQUIREMENT_MOVED_TO_PROJECT);
    expect(isStaleConflict(moved)).toBe(false);
    expect(isStaleConflict(apiErrorWith(409, { message: "version mismatch" }))).toBe(true);
  });
});

describe("legacy repository runs", () => {
  it("drops every permission on a run the server marks legacy", () => {
    const locked = lockLegacyRun({ ...qaRun(), legacy: true });
    expect(Object.values(locked.permissions).every((value) => value === false)).toBe(true);
    expect(locked.items.every((item) => item.canUpdate === false)).toBe(true);
  });

  it("leaves a run from an older backend as it is", () => {
    const run = qaRun();
    expect(lockLegacyRun(run)).toBe(run);
  });
});

describe("checklists owned by a Project", () => {
  it("reads the owning Project and whether the backend knows requirements", () => {
    expect(checklistOwningProjectId({ deliveryProjectId: "dp-1" })).toBe("dp-1");
    expect(checklistOwningProjectId({ deliveryProjectId: null })).toBeNull();
    expect(checklistOwningProjectId({ deliveryProjectId: 3 })).toBeNull();
    expect(checklistOwningProjectId({})).toBeNull();
    expect(backendHasProjectRequirements({ kind: "system" })).toBe(true);
    expect(backendHasProjectRequirements({})).toBe(false);
    expect(projectRequirementsHref("ws 1")).toBe("/workflows?group=ws+1");
    expect(projectRequirementsHref("ws-1", "dp-1")).toBe("/workflows?group=ws-1&project=dp-1");
  });
});

describe("where a repository's QA happens", () => {
  it("is the Project once the folder names one, nothing while it loads, the repository otherwise", () => {
    expect(qaScopeFromFolder("loading", null)).toEqual({ kind: "pending" });
    expect(qaScopeFromFolder("ready", { deliveryProjectId: "dp-1", name: " shop ", href: "/workflows" })).toEqual({
      kind: "project",
      deliveryProjectId: "dp-1",
      projectName: "shop",
      projectHref: "/workflows",
      repositoryRoles: {},
    });
    expect(qaScopeFromFolder("ready", { deliveryProjectId: "dp-1", name: null, href: null })).toMatchObject({ projectName: "this Project" });
    expect(qaScopeFromFolder("ready", { deliveryProjectId: null, name: "x", href: null })).toBe(REPOSITORY_SCOPE);
    expect(qaScopeFromFolder("unavailable", null)).toBe(REPOSITORY_SCOPE);
    expect(qaScopeFromFolder("idle", null)).toBe(REPOSITORY_SCOPE);
  });

  it("keeps a Project's QA on the page: no link away to the Projects page", () => {
    const scope = qaScopeFromFolder("ready", { deliveryProjectId: "dp-1", name: "shop", href: "/workflows" });
    expect(withProjectOnPage(scope)).toEqual({ ...scope, projectHref: null });
    expect(withProjectOnPage(REPOSITORY_SCOPE)).toBe(REPOSITORY_SCOPE);
    expect(withProjectOnPage({ kind: "pending" })).toEqual({ kind: "pending" });
  });
});

describe("the Project-level merge gate (section 3.2)", () => {
  function projectStatus(overrides: Record<string, unknown> = {}) {
    return normalizePromotionStatus(
      promotionWire({
        scope: "project",
        deliveryProject: { id: "dp-1", name: "storefront" },
        run: { id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: false },
        repositories: [headWire()],
        reasons: [],
        ...overrides,
      }),
    );
  }

  it("reads the additive fields and degrades them when absent", () => {
    const status = projectStatus({ requirementsChanged: true });
    expect(status.scope).toBe("project");
    expect(status.deliveryProject).toEqual({ id: "dp-1", name: "storefront" });
    expect(status.run).toEqual({ id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: false });
    expect(status.repositories).toHaveLength(1);
    expect(status.requirementsChanged).toBe(true);
    expect(normalizePromotionStatus(promotionWire({ scope: "galaxy", run: { verdict: "APPROVED" } }))).toMatchObject({
      scope: null,
      run: null,
      repositories: [],
    });
  });

  it("explains the Project run's state", () => {
    expect(promotionRunState(projectStatus())).toEqual({ tone: "success", label: "Project run approved for the current heads", approved: true });
    expect(promotionRunState(projectStatus({ run: { id: "r", verdict: "APPROVED", stale: true } })).tone).toBe("warning");
    expect(promotionRunState(projectStatus({ run: { id: "r", verdict: "REJECTED" } })).label).toBe("Latest sign-off is Rejected");
    expect(promotionRunState(projectStatus({ run: { id: "r", verdict: "CONDITIONAL" } })).label).toMatch(/Conditional/);
    expect(promotionRunState(projectStatus({ run: null })).label).toBe("QA has not signed the Project off yet");
    expect(approvedCountLabel(projectStatus())).toBe("Project run approved for the current heads");
    expect(approvedCountLabel(projectStatus({ scope: "unfiled" }))).toBe("Not filed under a Project");
  });

  it("blocks an unfiled repository with the Project reason", () => {
    const unfiled = projectStatus({ scope: "unfiled", eligible: false });
    expect(blockingReasons(unfiled)).toEqual([UNFILED_REASON]);
    expect(mergeDisabledReason(unfiled, null)).toBe(UNFILED_REASON);
    expect(blockingReasons(projectStatus({ eligible: false, reasons: [] }))[0]).toMatch(/QA must sign the Project off Approved/);
    expect(blockingReasons(projectStatus({ eligible: false, reasons: ['Project run is stale: "api" moved'] }))).toEqual([
      'Project run is stale: "api" moved',
    ]);
    expect(mergeDisabledReason(projectStatus({ eligible: false }), null)).toMatch(/QA signs the Project off Approved on its current uat build/);
    expect(mergeDisabledReason(projectStatus({ eligible: true }), HEAD_SHA)).toMatch(/already merged/);
    expect(mergeDisabledReason(projectStatus({ eligible: true }), null)).toBeNull();
    expect(SHA_BE_NEW).toHaveLength(40);
  });

  it("turns QA_PROJECT_REQUIRED on merge into a refresh with the Project reason", () => {
    const error = promotionMergeError(apiErrorWith(409, { code: "QA_PROJECT_REQUIRED" }));
    expect(error).toEqual({ kind: "project_required", message: UNFILED_REASON, reasons: [], signIn: false });
    expect(mergeErrorTitle("project_required")).toMatch(/not in a Project/);
    expect(mergeErrorClosesDialog(error)).toBe(true);
    expect(mergeErrorRefreshesStatus(error)).toBe(true);
  });
});
