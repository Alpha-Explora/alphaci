import { request } from "@/shared/api/request";
import {
  createHostEnrollment,
  listHosts,
  revokeHost,
  isOnpremHostingAvailable,
} from "./hosts-api";
import { assignHost, unassignHost } from "./assignments-api";
jest.mock("@/shared/api/request", () => ({
  request: jest.fn().mockResolvedValue([]),
}));
it("requires the enabled on-prem provider, even when managed providers are available", async () => {
  const mockedRequest = jest.mocked(request);
  mockedRequest.mockResolvedValueOnce({
    providers: [
      { id: "render", enabled: true },
      { id: "onprem-compose", enabled: false },
    ],
  });
  expect(await isOnpremHostingAvailable()).toBe(false);
  mockedRequest.mockResolvedValueOnce({
    providers: [{ id: "onprem-compose", enabled: true }],
  });
  expect(await isOnpremHostingAvailable()).toBe(true);
  mockedRequest.mockResolvedValueOnce({});
  expect(await isOnpremHostingAvailable()).toBe(false);
  mockedRequest.mockClear();
});
it("scopes inventory and enrollment to the explicit workspace and posts codes only in responses", async () => {
  await listHosts("workspace/a");
  await createHostEnrollment("w", {
    name: "machine",
    platform: "ubuntu",
    requestId: "request",
  });
  await revokeHost("w", "machine");
  expect(request).toHaveBeenNthCalledWith(
    1,
    "/workspaces/workspace%2Fa/onprem-hosts",
    { signal: undefined },
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    "/workspaces/w/onprem-host-enrollments",
    {
      method: "POST",
      body: JSON.stringify({
        name: "machine",
        platform: "ubuntu",
        requestId: "request",
      }),
    },
  );
});
it("passes explicit comparison and request id without another project creation", async () => {
  const input = {
    machineId: "m",
    expectedAssignmentId: "old",
    requestId: "request",
    config: {
      ports: [],
      health: [],
      ingress: { mode: "direct" as const, publicUrl: null },
    },
  };
  await assignHost("p", "e", input);
  await unassignHost("p", "e", "old");
  expect(request).toHaveBeenCalledWith(
    "/projects/p/environments/e/host-assignment",
    { method: "POST", body: JSON.stringify(input) },
  );
  expect(request).toHaveBeenCalledWith(
    "/projects/p/environments/e/host-assignment",
    { method: "DELETE", body: JSON.stringify({ expectedAssignmentId: "old" }) },
  );
});
