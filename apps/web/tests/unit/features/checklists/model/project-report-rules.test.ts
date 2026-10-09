import {
  normalizeProjectReport,
  projectReportBaseName,
  projectReportFilename,
  projectReportPageHref,
  repositoryHeadLabel,
} from "../../../../../src/features/checklists/model/project-report-rules";
import { projectReportWire } from "../project-report-fixtures";

describe("normalizeProjectReport", () => {
  it("reads the report and normalises its run, keeping the per-repository results", () => {
    const report = normalizeProjectReport(projectReportWire());
    expect(report).not.toBeNull();
    expect(report?.schemaVersion).toBe("qa-report/v2");
    expect(report?.frozen).toBe(false);
    expect(report?.project).toEqual({ id: "dp-1", name: "storefront" });
    expect(report?.run.id).toBe("prun-1");
    expect(report?.run.automationByRepository?.map((entry) => entry.projectId)).toEqual(["proj-fe", "proj-be"]);
    expect(report?.run.items).toHaveLength(2);
    expect(report?.summary.passed).toBe(1);
    expect(report?.defects).toHaveLength(1);
  });

  it("lists the covered repositories with the head each captured", () => {
    const report = normalizeProjectReport(projectReportWire());
    expect(report?.repositories.map((repository) => [repository.name, repository.headSha?.slice(0, 7)])).toEqual([
      ["storefront-web", "a1b2c3d"],
      ["orders-api", "e4f5a6b"],
    ]);
  });

  it("falls back to the run's project when the report names none, and derives a repository name", () => {
    const report = normalizeProjectReport(
      projectReportWire({
        project: null,
        repositories: [{ projectId: "p", repoFullName: "tone/shop", headSha: null }],
      }),
    );
    expect(report?.project).toEqual({ id: "dp-1", name: "storefront" });
    expect(report?.repositories).toEqual([{ projectId: "p", repoFullName: "tone/shop", name: "shop", headSha: null }]);
  });

  it("drops a repository without an id or a name", () => {
    const report = normalizeProjectReport(
      projectReportWire({ repositories: [{ projectId: "p" }, { repoFullName: "tone/x" }, null] }),
    );
    expect(report?.repositories).toEqual([]);
  });

  it("treats missing lists as empty, so an older report still draws", () => {
    const report = normalizeProjectReport(projectReportWire({ defects: undefined, signoffHistory: "nope" }));
    expect(report?.defects).toEqual([]);
    expect(report?.signoffHistory).toEqual([]);
  });

  it.each([
    ["nothing", null],
    ["a string", "report"],
    ["no run", projectReportWire({ run: null })],
    ["no summary", projectReportWire({ summary: null })],
  ])("returns null for %s", (_label, value) => {
    expect(normalizeProjectReport(value)).toBeNull();
  });
});

describe("project report names and links", () => {
  const report = normalizeProjectReport(projectReportWire({ project: { id: "dp-1", name: "My Store / EU" } }));

  it("names the file like the backend: project name, first seven of the run id", () => {
    expect(projectReportBaseName(report!)).toBe("QA-Report-My-Store-EU-prun-1");
    expect(projectReportFilename(report!, "json")).toBe("QA-Report-My-Store-EU-prun-1.json");
    expect(projectReportFilename(report!, "pdf")).toBe("QA-Report-My-Store-EU-prun-1.pdf");
  });

  it("links the print page, with ?print=1 only when asked", () => {
    expect(projectReportPageHref("dp 1", "run/1")).toBe("/qa/project-report/dp%201/run%2F1");
    expect(projectReportPageHref("dp-1", "run-1", { print: true })).toBe("/qa/project-report/dp-1/run-1?print=1");
  });

  it("labels a repository with the head it captured, or just its name", () => {
    expect(repositoryHeadLabel({ name: "storefront-web", headSha: "a1b2c3d4e5f6" })).toBe("storefront-web @ a1b2c3d");
    expect(repositoryHeadLabel({ name: "storefront-web", headSha: null })).toBe("storefront-web");
  });
});
