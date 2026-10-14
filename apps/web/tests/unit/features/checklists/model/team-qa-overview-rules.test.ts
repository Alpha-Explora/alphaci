import { normalizeTeamQaOverview } from "../../../../../src/features/checklists/model/team-qa-overview-rules";

/* GET /workspaces/:ws/qa-requirements/overview. A newer backend adds
 * latestRun, counts, promotion and viewerMembership to each Project; an older
 * one sends none of them, and every one must read as "not known". */

const requirement = {
  id: "req-1",
  kind: "functional",
  name: "Checkout",
  itemCount: 4,
  progressCounts: { todo: 1, in_progress: 2, done: 1 },
  verification: { pending: 1, passed: 2, failed: 0, blocked: 1, returned_to_dev: 0 },
  latestRunStatus: "open",
  archivedAt: null,
};

const newerGroup = {
  deliveryProject: { id: "dp-1", name: "Storefront" },
  requirements: [requirement],
  latestRun: {
    id: "run-1",
    status: "signed_off",
    createdAt: "2026-10-10T08:00:00Z",
    verdict: "CONDITIONAL",
    signedOffAt: "2026-10-11T08:00:00Z",
    signedOffBy: "ana-qa",
  },
  counts: {
    readyForQa: 3,
    openDefects: { blocker: 1, major: 2, minor: 0, unrated: 4 },
    members: { developer: 2, qa: 1 },
  },
  promotion: { mergedRepositories: 1, totalRepositories: 2, lastMergedAt: null },
  viewerMembership: "developer",
};

describe("normalizeTeamQaOverview", () => {
  it("reads every field a newer backend sends", () => {
    const overview = normalizeTeamQaOverview({ groups: [newerGroup], unassigned: [] });
    expect(overview.supports).toEqual({ latestRun: true, counts: true, promotion: true, viewerMembership: true });
    const [project] = overview.projects;
    expect(project.deliveryProject).toEqual({ id: "dp-1", name: "Storefront" });
    expect(project.requirements[0]).toEqual(requirement);
    expect(project.latestRun).toEqual(newerGroup.latestRun);
    expect(project.counts).toEqual(newerGroup.counts);
    expect(project.promotion).toEqual(newerGroup.promotion);
    expect(project.viewerMembership).toBe("developer");
  });

  it("reads an older backend's Project as not known, never as zero", () => {
    const overview = normalizeTeamQaOverview({
      groups: [{ deliveryProject: { id: "dp-1", name: "Storefront" }, requirements: [requirement] }],
    });
    expect(overview.supports).toEqual({ latestRun: false, counts: false, promotion: false, viewerMembership: false });
    const [project] = overview.projects;
    expect(project.latestRun).toBeNull();
    expect(project.counts).toEqual({ readyForQa: null, openDefects: null, members: null });
    expect(project.promotion).toBeNull();
    expect(project.viewerMembership).toBeNull();
    expect(project.requirements[0].verification?.passed).toBe(2);
  });

  it("drops broken rows and reads malformed values safely", () => {
    const overview = normalizeTeamQaOverview({
      groups: [
        { deliveryProject: {}, requirements: [] },
        "not a group",
        {
          deliveryProject: { id: "dp-2" },
          requirements: [{ name: "no id" }, { id: "r-2", kind: "odd", verification: "x", progressCounts: null }],
          latestRun: { id: "run-2", status: "closed" },
          counts: { readyForQa: -1, openDefects: "many", members: { developer: 1.5 } },
          promotion: { mergedRepositories: 1 },
          viewerMembership: "lead",
        },
      ],
    });
    expect(overview.projects).toHaveLength(1);
    const [project] = overview.projects;
    expect(project.deliveryProject.name).toBe("Project");
    expect(project.requirements).toEqual([
      expect.objectContaining({
        id: "r-2",
        kind: "system",
        name: "Untitled requirement",
        verification: null,
        latestRunStatus: null,
        progressCounts: { todo: 0, in_progress: 0, done: 0 },
      }),
    ]);
    expect(project.latestRun).toBeNull();
    expect(project.counts).toEqual({ readyForQa: null, openDefects: null, members: { developer: 0, qa: 0 } });
    expect(project.promotion).toBeNull();
    expect(project.viewerMembership).toBeNull();
  });

  it("names the signer from an actor object too", () => {
    const overview = normalizeTeamQaOverview({
      groups: [{ ...newerGroup, latestRun: { ...newerGroup.latestRun, signedOffBy: { id: "u1", login: "ana" } } }],
    });
    expect(overview.projects[0].latestRun?.signedOffBy).toBe("ana");
  });

  it("reads a body that is not an overview as empty", () => {
    expect(normalizeTeamQaOverview(null)).toEqual({
      projects: [],
      supports: { latestRun: false, counts: false, promotion: false, viewerMembership: false },
    });
  });
});
