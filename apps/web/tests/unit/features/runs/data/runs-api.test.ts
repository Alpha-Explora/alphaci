import { getRuns } from "../../../../../src/features/runs/data/runs-api";
import { request } from "../../../../../src/shared/api/request";

jest.mock("../../../../../src/shared/api/request", () => ({ request: jest.fn() }));

const mockRequest = request as jest.Mock;

describe("getRuns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({ runs: [] });
  });

  it("sends a plain GET with no filter", async () => {
    await getRuns();
    expect(mockRequest).toHaveBeenCalledWith("/ci/runs");
  });

  it("sends the team as workspaceId", async () => {
    await getRuns(undefined, { workspaceId: "ws 1" });
    expect(mockRequest).toHaveBeenCalledWith("/ci/runs?workspaceId=ws+1");
  });

  it("combines the repository and the team", async () => {
    await getRuns("acme/api", { workspaceId: "ws-1" });
    expect(mockRequest).toHaveBeenCalledWith(
      "/ci/runs?repoFullName=acme%2Fapi&workspaceId=ws-1",
    );
  });

  it("omits a null team", async () => {
    await getRuns(undefined, { workspaceId: null });
    expect(mockRequest).toHaveBeenCalledWith("/ci/runs");
  });
});
