import { request } from "../../../../../../src/shared/api/request";
import { createOnpremEnvironmentTarget } from "../../../../../../src/features/projects/detail/data/environments-api";

jest.mock("../../../../../../src/shared/api/request", () => ({
  request: jest.fn(),
}));

describe("createOnpremEnvironmentTarget", () => {
  it("creates one BYO provider target for the selected environment and slot", async () => {
    jest.mocked(request).mockResolvedValue({ id: "target-1" });

    await createOnpremEnvironmentTarget("project / 1", {
      environmentId: "env-1",
      slot: "backend",
      name: "Production host",
    });

    expect(request).toHaveBeenCalledWith(
      "/projects/project%20%2F%201/deployment-targets",
      {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          environmentId: "env-1",
          slot: "backend",
          ownershipMode: "byo",
          provider: "onprem-compose",
          providerProjectName: "Production host",
        }),
      },
    );
  });
});
