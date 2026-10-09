import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { requirementsRepository } from "../../../../../src/features/checklists/data/requirements-repository";
import { normalizeRequirementItem } from "../../../../../src/features/checklists/model/requirement-rules";
import { request, requestText } from "../../../../../src/shared/api/request";
import { projectReportWire } from "../project-report-fixtures";
import { itemWire, projectRequirementsWire, projectRunWire, requirementWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/shared/api/request", () => {
  const actual = jest.requireActual("../../../../../src/shared/api/request");
  return { ...actual, request: jest.fn(), requestText: jest.fn() };
});

const mockedRequest = request as jest.MockedFunction<typeof request>;
const mockedRequestText = requestText as jest.MockedFunction<typeof requestText>;

afterEach(() => jest.clearAllMocks());

describe("requirementsRepository", () => {
  it("lists a Project's requirements and normalises them", async () => {
    mockedRequest.mockResolvedValue(projectRequirementsWire());
    const data = await requirementsRepository.listForProject("dp 1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp%201/requirements");
    expect(data.requirements.map((entry) => entry.kind)).toEqual(["functional", "system"]);
  });

  it("creates, edits and archives by id", async () => {
    mockedRequest.mockResolvedValue(requirementWire());
    await requirementsRepository.create("dp-1", { kind: "functional", name: "Pay" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/delivery-projects/dp-1/requirements", {
      method: "POST",
      body: JSON.stringify({ kind: "functional", name: "Pay" }),
    });
    await requirementsRepository.update("req-1", { expectedVersion: 1, name: "Pay" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/requirements/req-1", {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion: 1, name: "Pay" }),
    });
    const archived = await requirementsRepository.archive("req-1");
    expect(mockedRequest).toHaveBeenLastCalledWith("/requirements/req-1/archive", { method: "POST" });
    expect(archived.id).toBe("req-1");
  });

  it("creates several requirements in ONE batch request, in request order", async () => {
    mockedRequest.mockResolvedValue({
      requirements: [requirementWire({ id: "req-a", name: "Wallet" }), { broken: true }, requirementWire({ id: "req-b", name: "Refunds" })],
    });
    const body = { kind: "functional" as const, requirements: [{ name: "Wallet" }, { name: "Refunds" }] };
    const created = await requirementsRepository.createBatch("dp 1", body);
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedRequest).toHaveBeenLastCalledWith("/delivery-projects/dp%201/requirements/batch", {
      method: "POST",
      body: JSON.stringify(body),
    });
    // A broken row is dropped rather than crashing the list.
    expect(created.map((entry) => entry.id)).toEqual(["req-a", "req-b"]);

    mockedRequest.mockResolvedValue({ requirements: [] });
    await expect(requirementsRepository.createBatch("dp-1", body)).rejects.toThrow(/did not return the requirements/);
    mockedRequest.mockResolvedValue(null);
    await expect(requirementsRepository.createBatch("dp-1", body)).rejects.toThrow(/did not return the requirements/);
  });

  it("refuses a reply that is not a requirement", async () => {
    mockedRequest.mockResolvedValue({});
    await expect(requirementsRepository.update("req-1", { expectedVersion: 1 })).rejects.toThrow(/did not return/);
    mockedRequest.mockResolvedValue(null);
    await expect(requirementsRepository.addItem("req-1", { title: "T" })).rejects.toThrow(/did not return/);
  });

  it("adds, edits, deletes and reorders items by id — never the legacy full replace", async () => {
    mockedRequest.mockResolvedValue(itemWire());
    const added = await requirementsRepository.addItem("req-1", { title: "T" });
    expect(added.requirementId).toBe("req-1");
    expect(mockedRequest).toHaveBeenLastCalledWith("/requirements/req-1/items", { method: "POST", body: JSON.stringify({ title: "T" }) });
    await requirementsRepository.updateItem("req-1", "item-1", { expectedRowVersion: 1, title: "U" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/requirements/req-1/items/item-1", {
      method: "PATCH",
      body: JSON.stringify({ expectedRowVersion: 1, title: "U" }),
    });
    mockedRequest.mockResolvedValue(undefined);
    await requirementsRepository.deleteItem("req-1", "item-1");
    expect(mockedRequest).toHaveBeenLastCalledWith("/requirements/req-1/items/item-1", { method: "DELETE" });
    await requirementsRepository.reorderItems("req-1", ["item-2", "item-1"]);
    expect(mockedRequest).toHaveBeenLastCalledWith("/requirements/req-1/items/order", {
      method: "PUT",
      body: JSON.stringify({ itemIds: ["item-2", "item-1"] }),
    });
    expect(mockedRequest.mock.calls.some(([path]) => String(path).includes("/qa-checklists/"))).toBe(false);
  });

  it("moves Progress with the row version read", async () => {
    const previous = normalizeRequirementItem(itemWire(), "req-1")!;
    mockedRequest.mockResolvedValue({ item: itemWire({ progress: "done", rowVersion: 2 }), readyForQaNotified: true });
    const result = await requirementsRepository.setProgress(previous, { progress: "done", expectedRowVersion: 1 });
    expect(mockedRequest).toHaveBeenCalledWith("/requirements/req-1/items/item-1/progress", {
      method: "PATCH",
      body: JSON.stringify({ progress: "done", expectedRowVersion: 1 }),
    });
    expect(result).toEqual({ item: { ...previous, progress: "done", rowVersion: 2 }, readyForQaNotified: true });
  });

  it("reduces the team overview to counts per Project", async () => {
    mockedRequest.mockResolvedValue({ groups: [{ deliveryProject: { id: "dp-1" }, requirements: [{ id: "r" }] }] });
    expect(await requirementsRepository.countsByProject("ws-1")).toEqual({ "dp-1": 1 });
    expect(mockedRequest).toHaveBeenCalledWith("/workspaces/ws-1/qa-requirements/overview");
  });
});

describe("projectQaRunsRepository", () => {
  it("reads the run on the current heads", async () => {
    mockedRequest.mockResolvedValue({ run: projectRunWire(), heads: [], stale: false });
    const current = await projectQaRunsRepository.current("dp-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/current");
    expect(current.run?.id).toBe("prun-1");
  });

  it("starts a run with no body — the server reads the heads — and says whether it existed", async () => {
    mockedRequest.mockResolvedValue({ created: true, run: projectRunWire() });
    expect((await projectQaRunsRepository.start("dp-1")).created).toBe(true);
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs", { method: "POST" });
    mockedRequest.mockResolvedValue({ created: false, run: projectRunWire() });
    expect((await projectQaRunsRepository.start("dp-1")).created).toBe(false);
    mockedRequest.mockResolvedValue({ created: true });
    await expect(projectQaRunsRepository.start("dp-1")).rejects.toThrow(/did not return/);
  });

  it("reads the Project report as qa-report/v2 JSON, normalised", async () => {
    mockedRequest.mockResolvedValue(projectReportWire());
    const report = await projectQaRunsRepository.report("dp-1", "prun-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/report?format=json");
    expect(report.schemaVersion).toBe("qa-report/v2");
    expect(report.run.automationByRepository).toHaveLength(2);
  });

  it("refuses a report with no run to draw", async () => {
    mockedRequest.mockResolvedValue({ schemaVersion: "qa-report/v2" });
    await expect(projectQaRunsRepository.report("dp-1", "prun-1")).rejects.toThrow(/did not return the QA report/);
  });

  it("reads the Project report as Markdown", async () => {
    mockedRequestText.mockResolvedValue("# QA Report");
    expect(await projectQaRunsRepository.reportMarkdown("dp-1", "prun-1")).toBe("# QA Report");
    expect(mockedRequestText).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/report?format=md", {
      headers: { Accept: "text/markdown" },
    });
  });

  it("reads one run", async () => {
    mockedRequest.mockResolvedValue(projectRunWire());
    expect((await projectQaRunsRepository.get("dp-1", "prun-1")).id).toBe("prun-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/prun-1");
    mockedRequest.mockResolvedValue({});
    await expect(projectQaRunsRepository.get("dp-1", "prun-1")).rejects.toThrow(/did not return/);
  });

  it("records Verification and returns the run, or null when the reply has none", async () => {
    mockedRequest.mockResolvedValue(projectRunWire());
    const body = { status: "passed" as const, expectedRowVersion: 1 };
    expect((await projectQaRunsRepository.setVerification("dp-1", "prun-1", "run-item-1", body))?.id).toBe("prun-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/items/run-item-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    mockedRequest.mockResolvedValue({ item: runItemWire() });
    expect(await projectQaRunsRepository.setVerification("dp-1", "prun-1", "run-item-1", body)).toBeNull();
  });

  it("signs off and reopens", async () => {
    mockedRequest.mockResolvedValue(projectRunWire({ status: "signed_off" }));
    await projectQaRunsRepository.signoff("dp-1", "prun-1", { verdict: "APPROVED" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/signoff", {
      method: "POST",
      body: JSON.stringify({ verdict: "APPROVED" }),
    });
    await projectQaRunsRepository.reopen("dp-1", "prun-1");
    expect(mockedRequest).toHaveBeenLastCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/reopen", { method: "POST" });
  });

  it("reads the project-wide My QA items", async () => {
    mockedRequest.mockResolvedValue({ todo: [{ requirement: { id: "req-1", name: "Pay", kind: "functional" }, item: itemWire(), runId: null, runItem: null }] });
    const data = await projectQaRunsRepository.myItems("dp-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa/my-items");
    expect(data.todo).toHaveLength(1);
    expect(data.returned).toEqual([]);
  });
});
