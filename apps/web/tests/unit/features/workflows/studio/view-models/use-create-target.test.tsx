import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useSearchParams } from "next/navigation";

import { getDeliveryProject } from "../../../../../../src/features/groups";
import { useCreateTarget, type CreateTarget } from "../../../../../../src/features/workflows/studio/view-models/use-create-target";

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));
jest.mock("../../../../../../src/features/groups", () => ({ getDeliveryProject: jest.fn() }));

const mockedParams = useSearchParams as jest.Mock;
const mockedGet = getDeliveryProject as jest.MockedFunction<typeof getDeliveryProject>;

const DP = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const WORKSPACES = [
  { id: "ws-1", name: "Checkout squad", kind: "team" as const, role: "admin" as const },
  { id: "ws-2", name: "Payments", kind: "team" as const, role: "member" as const },
];

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  jest.clearAllMocks();
});

interface Probe {
  target: CreateTarget;
  selected: string | null;
  tab: string;
  setSelected: (id: string | null) => void;
}

function renderTarget(initialSelected: string | null): { get: () => Probe; rerender: () => void } {
  let latest: Probe | undefined;
  function Harness() {
    const [selected, setSelected] = useState<string | null>(initialSelected);
    const [tab, setTab] = useState("current");
    const target = useCreateTarget({
      guest: false,
      workspaces: WORKSPACES,
      selectedWorkspaceId: selected,
      selectWorkspace: setSelected,
      openSetup: () => setTab("setup"),
    });
    // eslint-disable-next-line react-hooks/globals
    latest = { target, selected, tab, setSelected };
    return null;
  }
  root = createRoot(document.createElement("div"));
  act(() => root!.render(<Harness />));
  return { get: () => latest as Probe, rerender: () => act(() => root!.render(<Harness />)) };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useCreateTarget", () => {
  it("resolves ?project= and labels it while its own team is selected", async () => {
    mockedParams.mockReturnValue(new URLSearchParams(`tab=setup&group=ws-1&project=${DP}`));
    mockedGet.mockResolvedValue({ id: DP, name: "testfinals", groupId: "ws-1", status: "active" } as never);
    const { get } = renderTarget("ws-1");
    expect(get().target.initialGroupId).toBe("ws-1");
    await flush();
    expect(mockedGet).toHaveBeenCalledWith(DP);
    expect(get().target.label).toBe("Checkout squad / testfinals");
    expect(get().target.deliveryProjectIdFor("ws-1")).toBe(DP);
    expect(get().target.deliveryProjectIdFor("ws-2")).toBeUndefined();
    expect(get().target.workspaceId).toBe("ws-1");
    expect(get().target.projectKnown).toBe(true);
    expect(get().target.projectChosen).toBe(false);

    // The Project fixes the team: a different team selection does not move it.
    act(() => get().setSelected("ws-2"));
    expect(get().target.label).toBe("Checkout squad / testfinals");
    expect(get().target.workspaceId).toBe("ws-1");
  });

  it("takes the team from a resolved ?project= link when no team was selected", async () => {
    mockedParams.mockReturnValue(new URLSearchParams(`tab=setup&project=${DP}`));
    mockedGet.mockResolvedValue({ id: DP, name: "ledger", groupId: "ws-2", status: "active" } as never);
    const { get } = renderTarget(null);
    expect(get().target.workspaceId).toBeNull();
    expect(get().target.projectKnown).toBe(false);
    await flush();
    expect(get().target.workspaceId).toBe("ws-2");
    expect(get().target.projectKnown).toBe(true);
    expect(get().target.label).toBe("Payments / ledger");
    expect(get().target.deliveryProjectIdFor(get().target.workspaceId)).toBe(DP);
  });

  it("takes the team from a picked Project, and lets it go again", async () => {
    mockedParams.mockReturnValue(new URLSearchParams("tab=setup"));
    const { get } = renderTarget("ws-2");
    act(() => get().target.chooseProject({ id: "dp-9", name: "wallet", featureCount: 1 }));
    expect(get().target.workspaceId).toBe("ws-2");
    expect(get().target.projectKnown).toBe(true);
    expect(get().target.projectChosen).toBe(true);
    expect(get().target.chosenProjectId).toBe("dp-9");
    expect(get().target.label).toBe("Payments / wallet");

    act(() => get().target.chooseProject(null));
    expect(get().target.projectKnown).toBe(false);
    expect(get().target.label).toBeNull();
  });

  it("ignores an invalid or unresolvable project", async () => {
    mockedParams.mockReturnValue(new URLSearchParams("group=ws-1&project=nope"));
    const { get } = renderTarget("ws-1");
    await flush();
    expect(mockedGet).not.toHaveBeenCalled();
    expect(get().target.label).toBeNull();

    act(() => root?.unmount());
    mockedParams.mockReturnValue(new URLSearchParams(`group=ws-1&project=${DP}`));
    mockedGet.mockRejectedValue(new Error("404"));
    const second = renderTarget("ws-1");
    await flush();
    expect(second.get().target.deliveryProjectIdFor("ws-1")).toBeUndefined();
  });

  it("leaves ?project= to the Projects view when the link is not for the wizard", async () => {
    mockedParams.mockReturnValue(new URLSearchParams(`group=ws-1&project=${DP}`));
    mockedGet.mockResolvedValue({ id: DP, name: "testfinals", groupId: "ws-1", status: "active" } as never);
    const { get } = renderTarget("ws-1");
    await flush();
    expect(mockedGet).not.toHaveBeenCalled();
    expect(get().target.label).toBeNull();
    expect(get().target.deliveryProjectIdFor("ws-1")).toBeUndefined();
  });

  it("applies a later link to the same page: opens setup and selects the team", async () => {
    mockedParams.mockReturnValue(new URLSearchParams(""));
    const { get, rerender } = renderTarget(null);
    expect(get().tab).toBe("current");
    mockedParams.mockReturnValue(new URLSearchParams(`tab=setup&group=ws-2&project=${DP}`));
    mockedGet.mockResolvedValue({ id: DP, name: "ledger", groupId: "ws-2", status: "active" } as never);
    rerender();
    await flush();
    expect(get().tab).toBe("setup");
    expect(get().selected).toBe("ws-2");
    expect(get().target.label).toBe("Payments / ledger");
  });
});
