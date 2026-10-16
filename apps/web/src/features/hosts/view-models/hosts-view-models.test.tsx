import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useHostsViewModel } from "./use-hosts-view-model";
import { useHostAssignmentViewModel } from "./use-host-assignment-view-model";
import type { MachineAssignment, ReadinessCheck } from "../model/host-types";
import {
  AssignmentSummary,
  type AssignmentVm,
} from "../views/host-assignment-form";
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
const connected = (id: string) => ({
  id,
  workspaceId: "workspace",
  name: id,
  platform: "ubuntu" as const,
  agentVersion: "0.1.0",
  lastSeenAt: new Date().toISOString(),
  status: "connected" as const,
  checks: [],
});
it("assigns the only connected machine without a choice or host ports", async () => {
  jest
    .mocked(listHosts)
    .mockResolvedValue([
      connected("only"),
      { ...connected("old"), status: "offline" },
    ]);
  jest.mocked(assignHost).mockResolvedValue({
    id: "a",
    machineId: "only",
    projectId: "project",
    environmentId: "env",
    revision: 1,
    config: {
      ports: [{ slot: "frontend", hostPort: 8080, containerPort: 3000 }],
      health: [{ slot: "frontend", path: "/" }],
      ingress: { mode: "direct", publicUrl: null },
    },
    tunnel: null,
  });
  const seen = probe(() => useHostAssignmentViewModel(options));
  await settle();
  expect(seen().choices).toHaveLength(1);
  expect(seen().automatic?.id).toBe("only");
  expect(seen().canAssign).toBe(true);
  await act(() => seen().assign());
  const sent = jest.mocked(assignHost).mock.calls[0]?.[2];
  expect(sent).not.toHaveProperty("machineId");
  expect(sent?.config.ports).toEqual([
    { slot: "frontend", containerPort: 3000 },
  ]);
});
it("requires a choice when several machines are connected", async () => {
  jest.mocked(listHosts).mockResolvedValue([connected("a"), connected("b")]);
  const seen = probe(() => useHostAssignmentViewModel(options));
  await settle();
  expect(seen().canAssign).toBe(false);
  act(() => seen().setSelected("b"));
  await act(() => seen().assign());
  expect(jest.mocked(assignHost).mock.calls[0]?.[2].machineId).toBe("b");
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

const tunnelAssignment: MachineAssignment = {
  id: "a",
  machineId: "only",
  projectId: "project",
  environmentId: "env",
  revision: 1,
  config: {
    ports: [{ slot: "frontend", hostPort: 8080, containerPort: 3000 }],
    health: [{ slot: "frontend", path: "/" }],
    ingress: { mode: "tunnel", publicUrl: null },
  },
  tunnel: {
    status: "waiting",
    publicUrl: null,
    message: "Waiting for the machine to report its address",
    reportedAt: null,
  },
};
const reportedTunnel: MachineAssignment = {
  ...tunnelAssignment,
  tunnel: {
    status: "running",
    publicUrl: "https://quick-words.trycloudflare.com",
    message: "The tunnel is running.",
    reportedAt: "2026-10-16T00:00:00Z",
  },
};
const directAssignment: MachineAssignment = {
  ...tunnelAssignment,
  config: {
    ...tunnelAssignment.config,
    ingress: { mode: "direct", publicUrl: null },
  },
  tunnel: null,
};
const passedCheck: ReadinessCheck = {
  id: "ingress",
  status: "passed",
  message: "The HTTPS address answers.",
};
/** Lets the promise chains behind a timer tick settle inside act. */
async function flushPromises() {
  await act(async () => {
    for (let tick = 0; tick < 10; tick++) await Promise.resolve();
  });
}
/** Renders the Hosting summary for a view-model and returns its text. */
function renderSummary(vm: AssignmentVm) {
  const host = document.createElement("div");
  const summaryRoot = createRoot(host);
  act(() => summaryRoot.render(<AssignmentSummary vm={vm} />));
  return {
    text: host.textContent ?? "",
    unmount: () => act(() => summaryRoot.unmount()),
  };
}
describe("tunnel refresh on the assignment timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(listHosts).mockResolvedValue([connected("only")]);
  });
  it("picks up the tunnel report and readiness without touching an unsaved edit", async () => {
    jest.mocked(getAssignment).mockResolvedValue(tunnelAssignment);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [] });
    const seen = probe(() => useHostAssignmentViewModel(options));
    await flushPromises();
    expect(seen().current).toMatchObject({ tunnel: { status: "waiting" } });

    act(() => seen().port("frontend", "3100"));
    act(() => seen().health("frontend", "/ready"));
    await act(() => seen().assign());
    expect(seen().confirmation).toBe("replace");

    jest.mocked(getAssignment).mockResolvedValue(reportedTunnel);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [passedCheck] });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    await flushPromises();

    expect(getAssignment).toHaveBeenCalledTimes(2);
    expect(seen().current).toMatchObject({
      id: "a",
      tunnel: {
        status: "running",
        publicUrl: "https://quick-words.trycloudflare.com",
      },
    });
    expect(seen().checks).toEqual([passedCheck]);
    expect(seen().config.ports).toEqual([
      { slot: "frontend", containerPort: 3100 },
    ]);
    expect(seen().config.health).toEqual([
      { slot: "frontend", path: "/ready" },
    ]);
    expect(seen().confirmation).toBe("replace");
  });
  it("makes no assignment or readiness request while the assignment is not in tunnel mode", async () => {
    jest.mocked(getAssignment).mockResolvedValue(directAssignment);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [] });
    probe(() => useHostAssignmentViewModel(options));
    await flushPromises();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await flushPromises();
    // The machine list still refreshes on every tick: initial load plus three.
    expect(listHosts).toHaveBeenCalledTimes(4);
    expect(getAssignment).toHaveBeenCalledTimes(1);
    expect(getReadiness).toHaveBeenCalledTimes(1);
  });
  it("makes no tunnel request without a current assignment", async () => {
    jest.mocked(getAssignment).mockResolvedValue(null);
    probe(() => useHostAssignmentViewModel(options));
    await flushPromises();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await flushPromises();
    expect(getAssignment).toHaveBeenCalledTimes(1);
    expect(getReadiness).toHaveBeenCalledTimes(1);
  });
  it("keeps the last tunnel report and checks when a refresh fails", async () => {
    jest.mocked(getAssignment).mockResolvedValue(reportedTunnel);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [passedCheck] });
    const seen = probe(() => useHostAssignmentViewModel(options));
    await flushPromises();

    jest.mocked(getAssignment).mockRejectedValue(new Error("Network failure"));
    jest.mocked(getReadiness).mockResolvedValue({
      checks: [{ id: "ingress", status: "failed", message: "Not answering." }],
    });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    await flushPromises();

    expect(getAssignment).toHaveBeenCalledTimes(2);
    expect(seen().current).toMatchObject({
      tunnel: {
        status: "running",
        publicUrl: "https://quick-words.trycloudflare.com",
      },
    });
    expect(seen().checks).toEqual([passedCheck]);
    expect(seen().error).toBeNull();
  });
  it("follows the server when the assignment is replaced, and keeps an unsaved edit", async () => {
    jest.mocked(getAssignment).mockResolvedValue(reportedTunnel);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [passedCheck] });
    const seen = probe(() => useHostAssignmentViewModel(options));
    await flushPromises();
    act(() => seen().port("frontend", "3100"));

    // Someone else replaced the assignment: a new id, its tunnel not yet reported.
    jest
      .mocked(getAssignment)
      .mockResolvedValue({ ...tunnelAssignment, id: "b", revision: 2 });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    await flushPromises();

    expect(seen().current).toMatchObject({
      id: "b",
      revision: 2,
      tunnel: { status: "waiting", publicUrl: null },
    });
    expect(seen().config.ports).toEqual([
      { slot: "frontend", containerPort: 3100 },
    ]);
    const summary = renderSummary(seen());
    expect(summary.text).not.toContain("quick-words.trycloudflare.com");
    expect(summary.text).toContain(
      "Waiting for the machine to report its address",
    );
    summary.unmount();
  });
  it("falls back to no machine when the server has no assignment, and keeps an unsaved edit", async () => {
    jest.mocked(getAssignment).mockResolvedValue(reportedTunnel);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [passedCheck] });
    const seen = probe(() => useHostAssignmentViewModel(options));
    await flushPromises();
    act(() => seen().port("frontend", "3100"));
    act(() => seen().health("frontend", "/ready"));

    jest.mocked(getAssignment).mockResolvedValue(null);
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    await flushPromises();

    expect(seen().current).toBeNull();
    expect(seen().config.ports).toEqual([
      { slot: "frontend", containerPort: 3100 },
    ]);
    expect(seen().config.health).toEqual([
      { slot: "frontend", path: "/ready" },
    ]);
    const summary = renderSummary(seen());
    expect(summary.text).toContain("No machine assigned");
    expect(summary.text).not.toContain("quick-words.trycloudflare.com");
    summary.unmount();
  });
  it("does not send a replacement confirmed against an assignment the server has since replaced", async () => {
    jest.mocked(getAssignment).mockResolvedValue(tunnelAssignment);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [] });
    const seen = probe(() => useHostAssignmentViewModel(options));
    await flushPromises();
    await act(() => seen().assign());
    expect(seen().confirmation).toBe("replace");

    jest
      .mocked(getAssignment)
      .mockResolvedValue({ ...tunnelAssignment, id: "b", revision: 2 });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    await flushPromises();
    expect(seen().confirmation).toBe("replace");

    await act(() => seen().assign());
    expect(assignHost).not.toHaveBeenCalled();
    expect(seen().confirmation).toBeNull();
    expect(seen().error).toMatch(/changed on the server/);
  });
  it("does not put back an assignment that a save replaced while a refresh was in flight", async () => {
    const replaced: MachineAssignment = {
      ...tunnelAssignment,
      id: "b",
      revision: 2,
    };
    let answerRefresh!: (value: MachineAssignment) => void;
    jest
      .mocked(getAssignment)
      .mockResolvedValueOnce(tunnelAssignment)
      .mockReturnValueOnce(
        new Promise<MachineAssignment>((done) => {
          answerRefresh = done;
        }),
      )
      .mockResolvedValue(replaced);
    jest.mocked(getReadiness).mockResolvedValue({ checks: [] });
    jest.mocked(assignHost).mockResolvedValue(replaced);
    const seen = probe(() => useHostAssignmentViewModel(options));
    await flushPromises();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    await act(() => seen().assign());
    await act(() => seen().assign());
    await flushPromises();
    expect(seen().current).toMatchObject({ id: "b" });

    await act(async () => {
      answerRefresh(tunnelAssignment);
    });
    await flushPromises();
    expect(seen().current).toMatchObject({ id: "b" });
  });
});
