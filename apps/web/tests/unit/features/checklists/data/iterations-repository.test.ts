import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import { request } from "../../../../../src/shared/api/request";
import { currentWire } from "../iteration-fixtures";

jest.mock("../../../../../src/shared/api/request", () => {
  const actual = jest.requireActual("../../../../../src/shared/api/request");
  return { ...actual, request: jest.fn() };
});

const mockedRequest = request as jest.MockedFunction<typeof request>;

afterEach(() => jest.clearAllMocks());

describe("iterationsRepository", () => {
  it("reads the current version and normalises it", async () => {
    mockedRequest.mockResolvedValue(currentWire());
    const current = await iterationsRepository.current("dp/1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp%2F1/iterations/current");
    expect(current?.iteration.number).toBe(3);
    expect(current?.coveredRepositories).toHaveLength(2);
  });

  it("answers null for a reply that names no iteration", async () => {
    mockedRequest.mockResolvedValue({});
    await expect(iterationsRepository.current("dp-1")).resolves.toBeNull();
  });

  it("posts Merge all with no body", async () => {
    mockedRequest.mockResolvedValue({ repositories: [], delivered: false, iteration: null });
    const result = await iterationsRepository.mergeAll("dp-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/promotion/merge-all", { method: "POST" });
    expect(result).toEqual({ repositories: [], delivered: false, iteration: null });
  });

  it("starts the next version with the goal as JSON, and normalises the 201", async () => {
    mockedRequest.mockResolvedValue({
      iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" },
    });
    const started = await iterationsRepository.start("dp/1", { goal: "Loyalty points" });
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp%2F1/iterations", {
      method: "POST",
      body: JSON.stringify({ goal: "Loyalty points" }),
    });
    expect(started).toEqual({ iteration: expect.objectContaining({ number: 4 }) });
  });

  it("lets a 404 through for the caller to read as 'no versions here'", async () => {
    mockedRequest.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    await expect(iterationsRepository.current("dp-1")).rejects.toMatchObject({ status: 404 });
  });
});
