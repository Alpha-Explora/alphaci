import { ciRunReportRepository } from "../../../../../src/features/checklists/data/ci-run-report-repository";
import { request, requestText } from "../../../../../src/shared/api/request";
import { CI_REF, ciRunReportWire } from "../ci-run-report-fixtures";

jest.mock("../../../../../src/shared/api/request", () => {
  const actual = jest.requireActual("../../../../../src/shared/api/request");
  return { ...actual, request: jest.fn(), requestText: jest.fn() };
});

const mockedRequest = request as jest.MockedFunction<typeof request>;
const mockedRequestText = requestText as jest.MockedFunction<typeof requestText>;

afterEach(() => jest.clearAllMocks());

const QUERY = `repoFullName=acme%2Forders-api&branch=uat&commitSha=${CI_REF.commitSha}`;

describe("ciRunReportRepository", () => {
  it("reads the report as JSON for one repository, branch and commit, normalised", async () => {
    mockedRequest.mockResolvedValue(ciRunReportWire());
    const report = await ciRunReportRepository.report(CI_REF);
    expect(mockedRequest).toHaveBeenCalledWith(`/ci/runs/report?${QUERY}&format=json`);
    expect(report.schemaVersion).toBe("ci-run-report/v1");
    expect(report.stages).toHaveLength(4);
  });

  it("hands back the body untouched for saving", async () => {
    const body = ciRunReportWire();
    mockedRequest.mockResolvedValue(body);
    expect(await ciRunReportRepository.reportBody(CI_REF)).toBe(body);
    expect(mockedRequest).toHaveBeenCalledWith(`/ci/runs/report?${QUERY}&format=json`);
  });

  it("refuses a reply that names no execution", async () => {
    mockedRequest.mockResolvedValue({ schemaVersion: "ci-run-report/v1" });
    await expect(ciRunReportRepository.report(CI_REF)).rejects.toThrow(/did not return the CI report/);
  });

  it("reads the report as Markdown", async () => {
    mockedRequestText.mockResolvedValue("# CI results");
    expect(await ciRunReportRepository.reportMarkdown(CI_REF)).toBe("# CI results");
    expect(mockedRequestText).toHaveBeenCalledWith(`/ci/runs/report?${QUERY}&format=md`, {
      headers: { Accept: "text/markdown" },
    });
  });

  it("lets a failed request through, so the caller can say what went wrong", async () => {
    mockedRequest.mockRejectedValue(new Error("boom"));
    await expect(ciRunReportRepository.report(CI_REF)).rejects.toThrow("boom");
  });
});
