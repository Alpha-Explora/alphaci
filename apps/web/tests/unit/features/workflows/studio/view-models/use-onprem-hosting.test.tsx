import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useOnpremHosting } from "../../../../../../src/features/workflows/studio/view-models/use-onprem-hosting";
import type { OnpremHosting } from "../../../../../../src/features/workflows/studio/model/onprem-hosting-rules";

jest.mock("../../../../../../src/features/workflows/studio/data/deployment-providers-repository", () => ({
  deploymentProvidersRepository: { list: jest.fn() },
}));

const mockedList = (
  jest.requireMock(
    "../../../../../../src/features/workflows/studio/data/deployment-providers-repository",
  ) as { deploymentProvidersRepository: { list: jest.Mock } }
).deploymentProvidersRepository.list;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  jest.clearAllMocks();
});

async function settle(cycles = 3) {
  for (let index = 0; index < cycles; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function renderHook(open: boolean, guest = false) {
  let snapshot: OnpremHosting | null = null;
  function Probe({ on }: Readonly<{ on: boolean }>) {
    // A probe hands the hook's value back to the test; the write is the assertion.
    // eslint-disable-next-line react-hooks/globals
    snapshot = useOnpremHosting({ guest, open: on });
    return null;
  }
  root = createRoot(document.createElement("div"));
  act(() => root!.render(<Probe on={open} />));
  return {
    seen: () => snapshot,
    rerender: (on: boolean) => act(() => root!.render(<Probe on={on} />)),
  };
}

describe("useOnpremHosting", () => {
  it("is hidden until the providers answer, then offers on-prem when it is enabled", async () => {
    mockedList.mockResolvedValue([{ id: "onprem-compose", enabled: true }]);
    const { seen } = renderHook(true);
    expect(seen()).toEqual({ status: "hidden" });
    await settle();
    expect(seen()).toEqual({ status: "enabled" });
  });

  it("carries the server's reason when on-prem is listed but off", async () => {
    mockedList.mockResolvedValue([
      { id: "onprem-compose", enabled: false, reason: "On-prem is off here." },
    ]);
    const { seen } = renderHook(true);
    await settle();
    expect(seen()).toEqual({ status: "disabled", reason: "On-prem is off here." });
  });

  it("stays hidden when the read fails", async () => {
    mockedList.mockRejectedValue(new Error("offline"));
    const { seen } = renderHook(true);
    await settle();
    expect(seen()).toEqual({ status: "hidden" });
  });

  it("reads nothing for a guest", async () => {
    mockedList.mockResolvedValue([{ id: "onprem-compose", enabled: true }]);
    const { seen } = renderHook(true, true);
    await settle();
    expect(mockedList).not.toHaveBeenCalled();
    expect(seen()).toEqual({ status: "hidden" });
  });

  it("reads nothing until the wizard is active, and only once", async () => {
    mockedList.mockResolvedValue([{ id: "onprem-compose", enabled: true }]);
    const { seen, rerender } = renderHook(false);
    await settle();
    expect(mockedList).not.toHaveBeenCalled();
    rerender(true);
    await settle();
    expect(seen()).toEqual({ status: "enabled" });
    rerender(false);
    rerender(true);
    await settle();
    expect(mockedList).toHaveBeenCalledTimes(1);
  });
});
