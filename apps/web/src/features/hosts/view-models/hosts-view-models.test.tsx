import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useHostsViewModel } from "./use-hosts-view-model";
import { useHostAssignmentViewModel } from "./use-host-assignment-view-model";
import { createHostEnrollment, listHosts } from "../data/hosts-api";
import {
  assignHost,
  getAssignment,
  getReadiness,
} from "../data/assignments-api";
jest.mock("../data/hosts-api", () => ({
  listHosts: jest.fn(),
  createHostEnrollment: jest.fn(),
  revokeHost: jest.fn(),
}));
jest.mock("../data/assignments-api", () => ({
  assignHost: jest.fn(),
  getAssignment: jest.fn(),
  getReadiness: jest.fn(),
  unassignHost: jest.fn(),
}));
let root: Root;
function probe<T>(hook: () => T) {
  let snapshot: T;
  function Probe() {
    snapshot = hook();
    return null;
  }
  root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  return () => snapshot!;
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listHosts).mockResolvedValue([]);
  jest.mocked(getAssignment).mockResolvedValue(null);
  jest.mocked(getReadiness).mockResolvedValue({ checks: [] });
});
afterEach(() => {
  act(() => root?.unmount());
  jest.useRealTimers();
});
const receipt = {
  apiUrl: "https://api.example.com",
  id: "e",
  code: "private-code",
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  installer: {
    version: "0.1.0",
    url: "https://api.example/installer",
    sha256: "a".repeat(64),
  },
};
it("allows only one pending enrollment and keeps its code in the mounted workspace", async () => {
  let resolve!: (value: typeof receipt) => void;
  jest.mocked(createHostEnrollment).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const seen = probe(() => useHostsViewModel("workspace", true));
  await settle();
  let operation: Promise<void>;
  act(() => {
    seen().setName("Host");
  });
  act(() => {
    operation = seen().enroll();
    void seen().enroll();
  });
  expect(createHostEnrollment).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(receipt);
    await operation!;
  });
  expect(seen().receipt?.code).toBe("private-code");
  act(() => seen().dismiss());
  expect(seen().receipt).toBeNull();
});
it("does not let a viewer enroll", async () => {
  const seen = probe(() => useHostsViewModel("workspace", false));
  await settle();
  await act(() => seen().enroll());
  expect(createHostEnrollment).not.toHaveBeenCalled();
});
it("does not publish an enrollment response after leaving the workspace", async () => {
  let resolve!: (value: typeof receipt) => void;
  jest.mocked(createHostEnrollment).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const seen = probe(() => useHostsViewModel("old-workspace", true));
  await settle();
  let operation: Promise<void>;
  act(() => {
    operation = seen().enroll();
  });
  act(() => root.unmount());
  await act(async () => {
    resolve(receipt);
    await operation!;
  });
  expect(seen().receipt).toBeNull();
});
it("expires the displayed code from the server expiration timestamp", async () => {
  jest.useFakeTimers();
  jest.mocked(createHostEnrollment).mockResolvedValue({
    ...receipt,
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  });
  const seen = probe(() => useHostsViewModel("workspace", true));
  await settle();
  await act(() => seen().enroll());
  expect(seen().expired).toBe(false);
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(seen().expired).toBe(true);
});
const options = {
  projectId: "project",
  environmentId: "env",
  workspaceId: "workspace",
  slots: ["frontend"] as const,
  production: false,
  canManage: true,
};
it("reuses an assignment request after a network failure without creating another project", async () => {
  jest.mocked(assignHost).mockRejectedValue(new Error("Network failure"));
  const seen = probe(() => useHostAssignmentViewModel(options));
  await settle();
  act(() => seen().setSelected("machine"));
  await act(() => seen().assign());
  await act(() => seen().assign());
  expect(assignHost).toHaveBeenCalledTimes(2);
  expect(jest.mocked(assignHost).mock.calls[0]?.[2].requestId).toBe(
    jest.mocked(assignHost).mock.calls[1]?.[2].requestId,
  );
  expect(
    jest.mocked(assignHost).mock.calls[0]?.[2].expectedAssignmentId,
  ).toBeNull();
});
it("shows legacy bindings and invalidates replacement confirmation after edits", async () => {
  jest.mocked(getAssignment).mockResolvedValue({
    id: "legacy",
    machineId: null,
    config: null,
    name: "Legacy",
    projectId: "project",
    environmentId: "env",
    revision: 0,
  });
  const seen = probe(() => useHostAssignmentViewModel(options));
  await settle();
  act(() => seen().setSelected("machine"));
  await act(() => seen().assign());
  expect(seen().confirmation).toBe("replace");
  expect(assignHost).not.toHaveBeenCalled();
  act(() => seen().setSelected("other"));
  expect(seen().confirmation).toBeNull();
  await act(() => seen().assign());
  expect(assignHost).not.toHaveBeenCalled();
});
