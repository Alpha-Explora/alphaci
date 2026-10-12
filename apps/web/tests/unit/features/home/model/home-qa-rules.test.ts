import { homeLinkContext } from "../../../../../src/features/home/model/home-persona-rules";
import {
  defectTotals,
  failedOrBlockedCount,
  inProgressCount,
  isReadyForProduction,
  pendingCount,
  productionView,
  projectRunStatus,
  readyForRetestTotal,
  retestRows,
  returnedCount,
  returnedRows,
  verificationRows,
  verificationTotals,
} from "../../../../../src/features/home/model/home-qa-rules";
import {
  FOLDERS,
  LOYALTY,
  PAY,
  SHOP,
  olderOverview,
  overview,
  qaProject,
  requirementSummary,
} from "../home-persona-fixtures";

const links = homeLinkContext("ws-1", FOLDERS);

describe("overview sums", () => {
  it("sums verification over live requirements only", () => {
    expect(verificationTotals(SHOP)).toEqual({ pending: 2, passed: 3, failed: 1, blocked: 1, returned_to_dev: 2 });
    expect(returnedCount(SHOP)).toBe(2);
    expect(pendingCount(SHOP)).toBe(2);
    expect(failedOrBlockedCount(SHOP)).toBe(2);
    expect(inProgressCount(SHOP)).toBe(1);
  });

  it("reads a Project with no run as not verified, not zero", () => {
    expect(verificationTotals(LOYALTY)).toBeNull();
    expect(returnedCount(LOYALTY)).toBe(0);
    expect(failedOrBlockedCount(LOYALTY)).toBe(0);
  });

  it("takes the run state from latestRun, else from any requirement", () => {
    expect(projectRunStatus(SHOP)).toBe("open");
    expect(projectRunStatus(olderOverview().projects[1])).toBe("signed_off");
    expect(projectRunStatus(LOYALTY)).toBeNull();
  });

  it("totals ready for re-test only when the server sent counts", () => {
    expect(readyForRetestTotal(overview(), [SHOP, PAY])).toBe(2);
    expect(readyForRetestTotal(olderOverview(), olderOverview().projects)).toBeNull();
    expect(readyForRetestTotal(null, [])).toBeNull();
  });
});

describe("returnedRows (Developer)", () => {
  it("lists Projects with returned items, most first, opening My QA items", () => {
    const busy = qaProject("dp-busy", "Busy", {
      requirements: [requirementSummary({ returned_to_dev: 5 })],
    });
    const rows = returnedRows([SHOP, PAY, LOYALTY, busy], links);
    expect(rows.map((row) => [row.name, row.returned])).toEqual([
      ["Busy", 5],
      ["Storefront", 2],
    ]);
    expect(rows[1].href).toBe("/groups/ws-1/delivery-projects/dp-shop#my-qa-items");
    expect(rows[1].defects).toEqual({ blocker: 1, major: 0, minor: 2, unrated: 0 });
    expect(rows[0].defects).toBeNull();
  });

  it("is empty when nothing came back", () => {
    expect(returnedRows([PAY, LOYALTY], links)).toEqual([]);
  });
});

describe("verificationRows (QA Team)", () => {
  it("lists every Project with a run, open first, opening QA Studio on the frontend", () => {
    const rows = verificationRows([PAY, SHOP, LOYALTY], links);
    expect(rows.map((row) => [row.name, row.status, row.verdict])).toEqual([
      ["Storefront", "open", null],
      ["Payments", "signed_off", "APPROVED"],
    ]);
    expect(rows[0].href).toBe("/projects/p-shop-fe#qa");
    expect(rows[1].counts.passed).toBe(5);
  });

  it("works from an older backend's latestRunStatus", () => {
    const rows = verificationRows(olderOverview().projects, links);
    expect(rows.map((row) => [row.name, row.status, row.verdict])).toEqual([
      ["Storefront", "open", null],
      ["Payments", "signed_off", null],
    ]);
  });
});

describe("retestRows and defectTotals (QA Team)", () => {
  it("lists Projects with items ready for a re-test", () => {
    expect(retestRows(overview(), [SHOP, PAY, LOYALTY], links)).toEqual([
      { deliveryProjectId: "dp-shop", name: "Storefront", ready: 2, href: "/projects/p-shop-fe#qa" },
    ]);
  });

  it("says it needs a newer backend (null) when no counts came", () => {
    expect(retestRows(olderOverview(), olderOverview().projects, links)).toBeNull();
    expect(retestRows(null, [], links)).toBeNull();
  });

  it("totals open defects by severity", () => {
    expect(defectTotals([SHOP, PAY, LOYALTY])).toEqual({ blocker: 1, major: 1, minor: 2, unrated: 1 });
    expect(defectTotals(olderOverview().projects)).toBeNull();
  });
});

describe("productionView (Product owner)", () => {
  it("lists signed-off Projects with something left to merge, and quieter, open runs", () => {
    const view = productionView(overview(), links);
    expect(view.mode).toBe("full");
    expect(view.ready).toEqual([
      {
        deliveryProjectId: "dp-pay",
        name: "Payments",
        verdict: "APPROVED",
        signedOffBy: "ana-qa",
        signedOffAt: "2026-10-12T12:00:00Z",
        mergedRepositories: 0,
        totalRepositories: 1,
        href: "/projects/p-pay-be#po",
      },
    ]);
    expect(view.open).toEqual([
      { deliveryProjectId: "dp-shop", name: "Storefront", failed: 1, blocked: 1, href: "/projects/p-shop-fe#po" },
    ]);
  });

  it.each([
    ["rejected", { verdict: "REJECTED" as const }, {}],
    ["already merged everywhere", {}, { promotion: { mergedRepositories: 1, totalRepositories: 1, lastMergedAt: null } }],
    ["no promotion reported", {}, { promotion: null }],
    ["still open", { status: "open" as const }, {}],
  ])("leaves out a Project %s", (_label, run, project) => {
    const changed = { ...PAY, latestRun: { ...PAY.latestRun!, ...run }, ...project };
    expect(isReadyForProduction(changed)).toBe(false);
  });

  it("counts a Conditional sign-off as shippable", () => {
    expect(isReadyForProduction({ ...PAY, latestRun: { ...PAY.latestRun!, verdict: "CONDITIONAL" } })).toBe(true);
  });

  it("shows only the open or signed-off state from an older backend", () => {
    const view = productionView(olderOverview(), links);
    expect(view.mode).toBe("legacy");
    expect(view.ready).toEqual([]);
    expect(view.legacy.map((row) => [row.name, row.status, row.href])).toEqual([
      ["Payments", "signed_off", "/projects/p-pay-be#po"],
      ["Storefront", "open", "/projects/p-shop-fe#po"],
    ]);
  });

  it("has nothing to say without the overview", () => {
    expect(productionView(null, links)).toEqual({ mode: "unavailable", ready: [], open: [], legacy: [] });
  });
});
