import { homeLinkContext } from "../../../../../src/features/home/model/home-persona-rules";
import { latestRunByRepo } from "../../../../../src/features/home/model/home-run-rules";
import {
  NO_DEVELOPERS_REASON,
  NO_FEATURES_REASON,
  myWorkProjects,
  needsAttentionRows,
} from "../../../../../src/features/home/model/home-work-rules";
import { FOLDERS, LOYALTY, PAY, RUNS, SHOP, folder, olderOverview, overview } from "../home-persona-fixtures";

const links = homeLinkContext("ws-1", FOLDERS);

describe("myWorkProjects (Developer)", () => {
  it("lists each Project's repositories with their newest run, failing first", () => {
    const projects = myWorkProjects(FOLDERS, latestRunByRepo(RUNS), links);
    expect(projects.map((project) => project.name)).toEqual(["Storefront", "Payments", "Loyalty"]);
    expect(projects[0].href).toBe("/groups/ws-1/delivery-projects/dp-shop");
    expect(projects[0].repositories.map((repo) => [repo.name, repo.tone, repo.branch, repo.href])).toEqual([
      ["shop-fe", "failure", "dev", "/projects/p-shop-fe"],
      ["shop-be", "success", "main", "/projects/p-shop-be"],
    ]);
    expect(projects[1].repositories[0].tone).toBe("running");
    expect(projects[2].repositories).toEqual([]);
  });

  it("puts a Project with a failing repository first", () => {
    const quiet = folder({ deliveryProjectId: "dp-a", name: "Alpha" });
    const projects = myWorkProjects([quiet, FOLDERS[0]], latestRunByRepo(RUNS), links);
    expect(projects.map((project) => project.name)).toEqual(["Storefront", "Alpha"]);
  });

  it("shows an unlinked repository with no link and no run", () => {
    const unlinked = folder({
      deliveryProjectId: "dp-x",
      name: "X",
      repositories: [{ repositoryId: "r", name: "draft", repoFullName: null, status: "pending", project: null }],
    });
    const [project] = myWorkProjects([unlinked], new Map(), links);
    expect(project.repositories).toEqual([{ repositoryId: "r", name: "draft", href: null, tone: "none", branch: null }]);
  });

  it("says who a delivered Project waits for, and nothing while an iteration is active (Iterations phase 3)", () => {
    const delivered = overview([
      { ...SHOP, iteration: { number: 3, status: "delivered", deliveredAt: "2026-10-14T10:00:00.000Z" } },
      { ...PAY, iteration: { number: 2, status: "active", deliveredAt: null } },
      LOYALTY,
    ]);
    const projects = myWorkProjects(FOLDERS, latestRunByRepo(RUNS), links, delivered);
    const byName = new Map(projects.map((project) => [project.name, project.waiting]));
    expect(byName.get("Storefront")).toMatch(
      /^Iteration 3 was delivered on .+\. Waiting for the Product owner to start iteration 4\.$/,
    );
    expect(byName.get("Payments")).toBeNull();
    expect(byName.get("Loyalty")).toBeNull();
  });

  it("has no waiting line without the team overview or from an older backend", () => {
    expect(myWorkProjects(FOLDERS, latestRunByRepo(RUNS), links).every((project) => project.waiting === null)).toBe(true);
    const older = myWorkProjects(FOLDERS, latestRunByRepo(RUNS), links, olderOverview());
    expect(older.every((project) => project.waiting === null)).toBe(true);
  });
});

describe("needsAttentionRows (Product owner)", () => {
  it("flags Projects with no Features or no Developers, saying why", () => {
    const rows = needsAttentionRows(FOLDERS, overview(), true, links);
    expect(rows).toEqual([
      {
        deliveryProjectId: "dp-pay",
        name: "Payments",
        reasons: [NO_FEATURES_REASON, NO_DEVELOPERS_REASON],
        href: "/groups/ws-1/delivery-projects/dp-pay",
      },
    ]);
  });

  it("ignores Feature counts with the QA capability off (they are always 0 then)", () => {
    const rows = needsAttentionRows(FOLDERS, null, false, links);
    expect(rows).toEqual([]);
  });

  it("never flags a Project on a count the server did not send", () => {
    const noCounts = needsAttentionRows([folder({ deliveryProjectId: "dp-pay", name: "Payments", featureCount: null })], olderOverview(), true, links);
    expect(noCounts).toEqual([]);
  });
});
