import {
  approvableNames,
  approveAllLabel,
  groupSnapshots,
  inheritsUatReferences,
  isApprovable,
  isVisualBranch,
  markApproved,
  offersLoadLatest,
  visualApproveError,
  visualChipLabel,
  visualCounts,
  visualEmptyMessage,
  visualHeader,
  visualImageUrl,
  visualReadOnlyNote,
  visualReadOnlyReason,
  visualRequestRunId,
  withImageUrls,
} from "../../../../../../src/features/projects/detail/model/visual-check-rules";
import type {
  VisualChecksResponse,
  VisualSnapshot,
} from "../../../../../../src/features/projects/detail/model/visual-check-types";
import { ApiError } from "../../../../../../src/shared/api/request";

const BASE = "https://api.example.com/api/v1";

function shot(name: string, status: VisualSnapshot["status"], overrides: Partial<VisualSnapshot> = {}): VisualSnapshot {
  const path = (kind: string) => `/projects/p1/workspace/visual/image?kind=${kind}&branch=uat&runId=7&name=${name}`;
  return {
    name,
    status,
    baselineUrl: status === "new" ? null : path("baseline"),
    actualUrl: path("actual"),
    diffUrl: status === "changed" ? path("diff") : null,
    baselineApprovedBy: null,
    baselineApprovedAt: null,
    inheritedFrom: null,
    approved: false,
    ...overrides,
  };
}

function response(snapshots: VisualSnapshot[], canApprove = true): VisualChecksResponse {
  return {
    branch: "uat",
    runId: 7,
    commitSha: "abc1234",
    reportedAt: "2026-10-06T08:00:00Z",
    browser: "chromium",
    canApprove,
    snapshots,
  };
}

const MIXED = [
  shot("z-passed.png", "passed"),
  shot("home-mobile.png", "changed"),
  shot("signup.png", "new"),
  shot("about.png", "passed"),
  shot("home-desktop.png", "changed"),
];

describe("where visual checks exist", () => {
  it("is uat and main only", () => {
    expect(isVisualBranch("uat")).toBe(true);
    expect(isVisualBranch("main")).toBe(true);
    expect(isVisualBranch("dev")).toBe(false);
    expect(isVisualBranch("feature/x")).toBe(false);
  });

  it("asks for the Verify stage's run, or the latest without a usable id", () => {
    expect(visualRequestRunId(1234)).toBe(1234);
    expect(visualRequestRunId(0)).toBeNull();
    expect(visualRequestRunId(-1)).toBeNull();
    expect(visualRequestRunId(1.5)).toBeNull();
    expect(visualRequestRunId(undefined)).toBeNull();
    expect(visualRequestRunId(null)).toBeNull();
  });
});

describe("image URLs", () => {
  it("prefixes the API base onto a root-relative path", () => {
    expect(visualImageUrl(`${BASE}/`, "/projects/p1/workspace/visual/image?kind=diff")).toBe(
      `${BASE}/projects/p1/workspace/visual/image?kind=diff`,
    );
  });

  it("refuses anything that is not an API path", () => {
    expect(visualImageUrl(BASE, null)).toBeNull();
    expect(visualImageUrl(BASE, "")).toBeNull();
    expect(visualImageUrl(BASE, "https://evil.example.com/x.png")).toBeNull();
    expect(visualImageUrl(BASE, "//evil.example.com/x.png")).toBeNull();
  });

  it("resolves every image of a response and leaves an empty one alone", () => {
    const resolved = withImageUrls(response([shot("a.png", "changed")]), BASE);
    expect(resolved.snapshots[0]).toMatchObject({
      baselineUrl: `${BASE}/projects/p1/workspace/visual/image?kind=baseline&branch=uat&runId=7&name=a.png`,
      actualUrl: `${BASE}/projects/p1/workspace/visual/image?kind=actual&branch=uat&runId=7&name=a.png`,
      diffUrl: `${BASE}/projects/p1/workspace/visual/image?kind=diff&branch=uat&runId=7&name=a.png`,
    });
    const empty: VisualChecksResponse = { branch: "main", runId: null, canApprove: false, snapshots: [] };
    expect(withImageUrls(empty, BASE)).toBe(empty);
  });
});

describe("order and counts", () => {
  it("puts changed first, then new, then passed, each sorted by name", () => {
    const groups = groupSnapshots(MIXED);
    expect(groups.changed.map((s) => s.name)).toEqual(["home-desktop.png", "home-mobile.png"]);
    expect(groups.added.map((s) => s.name)).toEqual(["signup.png"]);
    expect(groups.passed.map((s) => s.name)).toEqual(["about.png", "z-passed.png"]);
  });

  it("counts each status", () => {
    expect(visualCounts(MIXED)).toEqual({ changed: 2, added: 1, passed: 2 });
  });

  it("writes the header, leaving out zeros", () => {
    expect(visualHeader({ changed: 2, added: 1, passed: 5 })).toBe(
      "Visual checks · 2 changed · 1 new · 5 unchanged",
    );
    expect(visualHeader({ changed: 0, added: 0, passed: 3 })).toBe("Visual checks · 3 unchanged");
    expect(visualHeader({ changed: 0, added: 0, passed: 0 })).toBe("Visual checks · no screenshots captured");
  });

  it("chips only a changed screenshot, and only once read", () => {
    expect(visualChipLabel(null)).toBeNull();
    expect(visualChipLabel(response(MIXED))).toBe("Visual: 2 changed");
    expect(visualChipLabel(response([shot("a.png", "new"), shot("b.png", "passed")]))).toBeNull();
  });

  it("notices a main screenshot compared with uat's reference", () => {
    expect(inheritsUatReferences(MIXED)).toBe(false);
    expect(inheritsUatReferences([shot("a.png", "passed", { inheritedFrom: "uat" })])).toBe(true);
  });

  it("names the branch in the empty state", () => {
    expect(visualEmptyMessage("uat")).toBe(
      "No visual checks reported for uat yet. They run with the browser tests after each deploy.",
    );
  });
});

describe("approving", () => {
  it("offers only changed or new screenshots with an image that are not approved yet", () => {
    expect(isApprovable(shot("a.png", "changed"))).toBe(true);
    expect(isApprovable(shot("a.png", "new"))).toBe(true);
    expect(isApprovable(shot("a.png", "passed"))).toBe(false);
    expect(isApprovable(shot("a.png", "changed", { approved: true }))).toBe(false);
    expect(isApprovable(shot("a.png", "new", { actualUrl: null }))).toBe(false);
  });

  it("sends changed then new for Approve all", () => {
    const names = approvableNames([...MIXED, shot("done.png", "changed", { approved: true })]);
    expect(names).toEqual(["home-desktop.png", "home-mobile.png", "signup.png"]);
    expect(approveAllLabel(names.length)).toBe("Approve all (3)");
  });

  it("marks the confirmed names approved", () => {
    const marked = markApproved(response(MIXED), ["signup.png"]);
    expect(marked.snapshots.filter((s) => s.approved).map((s) => s.name)).toEqual(["signup.png"]);
  });
});

describe("read-only reasons", () => {
  it("shows actions to an approving role on the latest run", () => {
    for (const appRole of ["member", "lead", "admin"] as const) {
      expect(visualReadOnlyReason({ canApprove: true, appRole, roleForbidden: false })).toBeNull();
    }
  });

  it("explains a role that cannot approve, an unknown role, and a server refusal", () => {
    expect(visualReadOnlyReason({ canApprove: false, appRole: "qa", roleForbidden: false })).toBe("role");
    expect(visualReadOnlyReason({ canApprove: false, appRole: undefined, roleForbidden: false })).toBe("role");
    expect(visualReadOnlyReason({ canApprove: true, appRole: "member", roleForbidden: true })).toBe("role");
    expect(visualReadOnlyNote("role", "uat")).toBe(
      "Only developers, team leads and admins can approve visual changes.",
    );
  });

  it("explains an older run for an approving role", () => {
    expect(visualReadOnlyReason({ canApprove: false, appRole: "lead", roleForbidden: false })).toBe("not-latest");
    expect(visualReadOnlyNote("not-latest", "main")).toBe(
      "This is not the latest visual run for main, so it can't be approved here.",
    );
  });
});

describe("approval errors", () => {
  it("offers the latest run on SUPERSEDED", () => {
    const error = visualApproveError(
      new ApiError("409", 409, { code: "VISUAL_RUN_SUPERSEDED", latestRunId: 99, message: "x" }),
    );
    expect(error).toMatchObject({ kind: "superseded", latestRunId: 99, names: [] });
    expect(error.message).toContain("a newer visual run");
    expect(offersLoadLatest(error)).toBe(true);
  });

  it("names the offenders on NOT_APPROVABLE", () => {
    const error = visualApproveError(
      new ApiError("409", 409, { code: "visual_not_approvable", names: ["a.png", "b.png", 3] }),
    );
    expect(error.kind).toBe("not-approvable");
    expect(error.names).toEqual(["a.png", "b.png"]);
    expect(error.message).toBe(
      "Nothing was approved: a.png, b.png can't be approved — already passing, unknown, or without a captured screenshot.",
    );
    expect(offersLoadLatest(error)).toBe(false);
  });

  it("explains ROLE_FORBIDDEN and NOT_FOUND", () => {
    expect(visualApproveError(new ApiError("403", 403, { code: "VISUAL_APPROVE_ROLE_FORBIDDEN" }))).toMatchObject({
      kind: "forbidden",
      message: "Only developers, team leads and admins can approve visual changes.",
    });
    const missing = visualApproveError(new ApiError("404", 404, { code: "VISUAL_RUN_NOT_FOUND" }));
    expect(missing.kind).toBe("not-found");
    expect(offersLoadLatest(missing)).toBe(true);
  });

  it("falls back to the server's sentence, then a generic one", () => {
    expect(visualApproveError(new ApiError("500", 500, { message: "Storage is down." })).message).toBe(
      "Storage is down.",
    );
    expect(visualApproveError(new Error("offline"))).toMatchObject({
      kind: "failed",
      message: "The approval could not be saved. Try again in a moment.",
    });
    expect(offersLoadLatest(null)).toBe(false);
  });
});
