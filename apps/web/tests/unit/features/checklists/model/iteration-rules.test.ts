import {
  canOfferMergeAll,
  coveredRepositoryState,
  deliveredBannerTitle,
  deliveredRepositoryDetail,
  iterationDateLabel,
  iterationLockedText,
  iterationStatusLabel,
  lockedIterationNumber,
  mergeAllError,
  mergeAllErrorRefreshes,
  mergeAllErrorTitle,
  mergeAllFailures,
  mergeAllRowState,
  mergeAllSummary,
  normalizeCurrentIteration,
  normalizeIteration,
  normalizeIterationRef,
  normalizeMergeAll,
  pendingRepositories,
} from "../../../../../src/features/checklists/model/iteration-rules";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import { qaCodeMessage } from "../../../../../src/features/checklists/model/qa-error-messages";
import { normalizeTeamQaOverview } from "../../../../../src/features/checklists/model/team-qa-overview-rules";
import { apiErrorWith } from "../qa-promotion-fixtures";
import { currentWire, DELIVERED_AT } from "../iteration-fixtures";
import { projectRunWire } from "../requirement-fixtures";


describe("reading versions off the wire", () => {
  it("reads a ref only when id, number and status are all there", () => {
    expect(normalizeIterationRef({ id: "it-1", number: 1, status: "active" })).toEqual({ id: "it-1", number: 1, status: "active" });
    expect(normalizeIterationRef({ id: "it-1", number: 0, status: "active" })).toBeNull();
    expect(normalizeIterationRef({ id: "it-1", number: 1, status: "shipped" })).toBeNull();
    expect(normalizeIterationRef(undefined)).toBeNull();
  });

  it("reads who delivered it from the actor object or a plain login", () => {
    const fromActor = normalizeIteration({ id: "it-1", number: 1, status: "delivered", deliveredAt: DELIVERED_AT, deliveredBy: { id: "u", login: "ana" } });
    expect(fromActor?.deliveredByLogin).toBe("ana");
    expect(normalizeIteration({ id: "it-1", number: 1, status: "delivered", deliveredByLogin: "bo" })?.deliveredByLogin).toBe("bo");
  });

  it("reads the current version with its covered and delivered repositories", () => {
    const current = normalizeCurrentIteration(
      currentWire({
        deliveredRepositories: [
          { projectId: "proj-fe", repoFullName: "tone/storefront-web", uatHeadSha: "aaa", mergeSha: "abc1234ffff", prNumber: 12, how: "merged", at: DELIVERED_AT },
          { projectId: "bad", how: "teleported" },
        ],
      }),
    );
    expect(current?.iteration).toEqual({ id: "it-3", number: 3, status: "active", goal: null, deliveredAt: null, deliveredByLogin: null });
    expect(current?.canMergeAll).toBe(true);
    expect(current?.deliveredRepositories).toEqual([
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", how: "merged", mergeSha: "abc1234ffff", prNumber: 12 },
    ]);
    expect(current?.coveredRepositories.map((repository) => repository.delivered)).toEqual([true, false]);
  });

  it("is null for a reply that names no iteration, and the Phase 1 shape reads with empty lists", () => {
    expect(normalizeCurrentIteration({})).toBeNull();
    expect(normalizeCurrentIteration("nope")).toBeNull();
    const phase1 = normalizeCurrentIteration({ iteration: currentWire().iteration, canStartNext: false, deliveredRepositories: [] });
    expect(phase1?.coveredRepositories).toEqual([]);
    expect(phase1?.canMergeAll).toBe(false);
  });

  it("reads a Merge all answer; `merged` and `delivered` only when exactly true", () => {
    const result = normalizeMergeAll({
      repositories: [
        { projectId: "proj-fe", repoFullName: "tone/storefront-web", merged: true, how: "merged", message: null },
        { projectId: "proj-be", repoFullName: "tone/orders-api", merged: false, how: null, message: "Required review missing" },
        { projectId: "proj-x", repoFullName: "tone/x", merged: false, how: "already_in_main", message: "main already contains this commit" },
      ],
      delivered: "true",
      iteration: null,
    });
    expect(result.delivered).toBe(false);
    expect(result.repositories.map(mergeAllRowState)).toEqual([
      { tone: "success", label: "Merged into main" },
      { tone: "danger", label: "Not merged" },
      { tone: "success", label: "Already in main" },
    ]);
    expect(mergeAllFailures(result).map((row) => row.projectId)).toEqual(["proj-be"]);
    expect(mergeAllSummary(result)).toBe("2 of 3 repositories reached main. Retry merges only the rest.");
  });

  it("says the version was delivered when the call delivered it", () => {
    const result = normalizeMergeAll({ repositories: [], delivered: true, iteration: { id: "it-3", number: 3, status: "delivered" } });
    expect(mergeAllSummary(result)).toBe("Version 3 delivered.");
  });

  it("reads the overview's version per Project, null on an older backend", () => {
    const overview = normalizeTeamQaOverview({
      groups: [
        { deliveryProject: { id: "dp-1", name: "A" }, iteration: { number: 2, status: "delivered", deliveredAt: DELIVERED_AT } },
        { deliveryProject: { id: "dp-2", name: "B" } },
      ],
    });
    expect(overview.projects[0].iteration).toEqual({ number: 2, status: "delivered", deliveredAt: DELIVERED_AT });
    expect(overview.projects[1].iteration).toBeNull();
  });
});

describe("names and dates", () => {
  it("labels the header status in the viewer's locale", () => {
    expect(iterationStatusLabel({ number: 3, status: "active", deliveredAt: null }, "en-GB")).toBe("Version 3 · Active");
    expect(iterationStatusLabel({ number: 3, status: "delivered", deliveredAt: DELIVERED_AT }, "en-GB")).toBe("Version 3 · Delivered 14 Oct");
    expect(iterationStatusLabel({ number: 3, status: "delivered", deliveredAt: DELIVERED_AT }, "en-US")).toBe("Version 3 · Delivered Oct 14");
    expect(iterationStatusLabel({ number: 3, status: "delivered", deliveredAt: "not a date" }, "en-GB")).toBe("Version 3 · Delivered");
    expect(iterationDateLabel(null)).toBeNull();
  });

  it("names the delivery and who delivered it", () => {
    expect(deliveredBannerTitle({ number: 3, deliveredAt: DELIVERED_AT, deliveredByLogin: "ana" }, "en-GB")).toBe(
      "Version 3 delivered on 14 Oct 2026 by @ana",
    );
    expect(deliveredBannerTitle({ number: 3, deliveredAt: null, deliveredByLogin: null })).toBe("Version 3 delivered");
    expect(iterationLockedText(3)).toBe("Version 3 was delivered. Changes are locked.");
  });

  it("says how each repository reached main", () => {
    expect(deliveredRepositoryDetail({ how: "merged", prNumber: 12, mergeSha: "abc1234ffff" })).toBe("Merged into main · PR #12 · merge commit abc1234");
    expect(deliveredRepositoryDetail({ how: "already_in_main", prNumber: null, mergeSha: null })).toBe("Already in main");
    expect(coveredRepositoryState({ delivered: false, how: null })).toEqual({ tone: "neutral", label: "Not in main yet" });
    expect(coveredRepositoryState({ delivered: true, how: "already_in_main" })).toEqual({ tone: "success", label: "Already in main" });
  });

  it("locks only a delivered iteration", () => {
    expect(lockedIterationNumber({ number: 3, status: "delivered" })).toBe(3);
    expect(lockedIterationNumber({ number: 3, status: "active" })).toBeNull();
    expect(lockedIterationNumber(null)).toBeNull();
  });
});

describe("who is offered Merge all repositories", () => {
  const current = normalizeCurrentIteration(currentWire());

  it("needs two or more covered repositories, the server's canMergeAll, an active version and a lead or admin", () => {
    expect(canOfferMergeAll(current, "lead")).toBe(true);
    expect(canOfferMergeAll(current, "admin")).toBe(true);
    expect(canOfferMergeAll(current, "qa")).toBe(false);
    expect(canOfferMergeAll(current, "member")).toBe(false);
    expect(canOfferMergeAll(normalizeCurrentIteration(currentWire({ canMergeAll: false })), "lead")).toBe(false);
    const single = normalizeCurrentIteration(currentWire({ coveredRepositories: [{ projectId: "p", repoFullName: "t/p", delivered: false, how: null }] }));
    expect(canOfferMergeAll(single, "lead")).toBe(false);
    expect(canOfferMergeAll(null, "lead")).toBe(false);
  });

  it("merges only what is not in main yet", () => {
    expect(pendingRepositories(current!).map((repository) => repository.projectId)).toEqual(["proj-be"]);
  });
});

describe("a Merge all that was refused", () => {
  it("maps ITERATION_DELIVERED, naming the iteration", () => {
    const error = mergeAllError(apiErrorWith(409, { code: "ITERATION_DELIVERED", message: "Version 3 was delivered. Start the next version to change this.", iterationNumber: 3 }));
    expect(error.kind).toBe("delivered");
    expect(error.message).toBe("Version 3 was delivered, so its requirements and QA are locked.");
    expect(mergeAllErrorTitle(error.kind)).toBe("Already delivered");
    expect(mergeAllErrorRefreshes(error)).toBe(true);
  });

  it("maps QA_PROMOTION_BLOCKED with the gate's reasons", () => {
    const error = mergeAllError(apiErrorWith(409, { code: "QA_PROMOTION_BLOCKED", message: "Not eligible.", reasons: ["The run is Conditional."] }));
    expect(error).toEqual({ kind: "blocked", message: "Not eligible.", reasons: ["The run is Conditional."], signIn: false });
  });

  it("maps PROJECT_HAS_NO_REPOSITORIES, 403, 401 and anything else", () => {
    expect(mergeAllError(apiErrorWith(409, { code: "PROJECT_HAS_NO_REPOSITORIES" })).message).toBe(
      "This Project has no repositories yet, so there is nothing to merge to main. Add a repository first.",
    );
    expect(mergeAllError(apiErrorWith(403)).message).toBe("Only a Product owner or admin can merge this Project's repositories into main.");
    expect(mergeAllError(apiErrorWith(401))).toMatchObject({ kind: "reauth", signIn: true });
    expect(mergeAllError(new Error("boom"))).toMatchObject({ kind: "failed", message: "The merge could not be completed. Try again in a moment." });
  });

  it("maps ITERATION_DELIVERED on every other write too, with or without the number", () => {
    expect(qaCodeMessage(apiErrorWith(409, { code: "ITERATION_DELIVERED", iterationNumber: 2 }))).toBe(
      "Version 2 was delivered, so its requirements and QA are locked.",
    );
    expect(qaCodeMessage(apiErrorWith(409, { code: "ITERATION_DELIVERED" }))).toBe(
      "This version was delivered, so its requirements and QA are locked.",
    );
  });
});

describe("a delivered iteration's run", () => {
  it("is read-only whatever its flags say", () => {
    const run = normalizeProjectRun(
      projectRunWire({
        iteration: { id: "it-3", number: 3, status: "delivered" },
        attachments: { enabled: true, canAdd: true },
      }),
    )!;
    expect(run.iteration).toEqual({ id: "it-3", number: 3, status: "delivered" });
    expect(run.permissions).toEqual({
      canSetVerification: false,
      canSignOff: false,
      canReopen: false,
      canDispatch: false,
      canManageTestCases: false,
    });
    expect(run.items.every((item) => item.canUpdate === false)).toBe(true);
    expect(run.attachments).toEqual({ enabled: true, canAdd: false });
  });

  it("is unchanged on an active version and on an older backend", () => {
    const active = normalizeProjectRun(projectRunWire({ iteration: { id: "it-3", number: 3, status: "active" } }))!;
    expect(active.permissions.canSetVerification).toBe(true);
    const older = normalizeProjectRun(projectRunWire())!;
    expect(older.iteration).toBeNull();
    expect(older.permissions.canSetVerification).toBe(true);
  });
});
