import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  useApiResource,
  timeAgo,
  type UseApiResourceResult,
} from "../../src/features/groups/view-models/use-hierarchy-resource";
import { ApiError } from "../../src/shared/api/request";

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("use-hierarchy", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  function renderResource<T>(
    fetcher: () => Promise<T>,
    options?: Parameters<typeof useApiResource<T>>[2],
  ) {
    const snapshots: UseApiResourceResult<T>[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Probe() {
      snapshots.push(useApiResource<T>(fetcher, [], options));
      return null;
    }

    act(() => {
      root?.render(<Probe />);
    });

    return snapshots;
  }

  function latest<T>(snapshots: UseApiResourceResult<T>[]) {
    return snapshots[snapshots.length - 1];
  }

  it("resolves to the ready state with the fetched data", async () => {
    const snapshots = renderResource(async () => ["a", "b"]);
    expect(latest(snapshots).state).toBe("loading");

    await flushEffects();

    expect(latest(snapshots).state).toBe("ready");
    expect(latest(snapshots).data).toEqual(["a", "b"]);
  });

  it("resolves to the empty state when emptyWhen matches", async () => {
    const snapshots = renderResource(async () => [] as string[], {
      emptyWhen: (data) => data.length === 0,
    });

    await flushEffects();

    expect(latest(snapshots).state).toBe("empty");
  });

  it("maps a 403 ApiError to the forbidden state", async () => {
    const snapshots = renderResource(async () => {
      throw new ApiError("nope", 403);
    });

    await flushEffects();

    expect(latest(snapshots).state).toBe("forbidden");
    expect(latest(snapshots).error).toBeNull();
  });

  it("maps a 404 ApiError to the notfound state", async () => {
    const snapshots = renderResource(async () => {
      throw new ApiError("missing", 404);
    });

    await flushEffects();

    expect(latest(snapshots).state).toBe("notfound");
  });

  it("maps other ApiError statuses to the error state with a message", async () => {
    const snapshots = renderResource(async () => {
      throw new ApiError("boom", 500);
    });

    await flushEffects();

    expect(latest(snapshots).state).toBe("error");
    expect(latest(snapshots).error).toContain("500");
  });

  it("maps a non-ApiError to the generic error state", async () => {
    const snapshots = renderResource(async () => {
      throw new Error("network down");
    });

    await flushEffects();

    expect(latest(snapshots).state).toBe("error");
    expect(latest(snapshots).error).toBe("Something went wrong loading this view.");
  });

  it("does not fetch while disabled", async () => {
    const fetcher = jest.fn(async () => ["x"]);
    const snapshots = renderResource(fetcher, { enabled: false });

    await flushEffects();

    expect(fetcher).not.toHaveBeenCalled();
    expect(latest(snapshots).state).toBe("loading");
  });

  it("re-runs the fetcher on reload", async () => {
    const fetcher = jest.fn(async () => ["one"]);
    const snapshots = renderResource(fetcher);
    await flushEffects();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      latest(snapshots).reload();
    });
    await flushEffects();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(latest(snapshots).state).toBe("ready");
  });

  it("applies optimistic updates via setData", async () => {
    const snapshots = renderResource(async () => ["a"]);
    await flushEffects();

    await act(async () => {
      latest(snapshots).setData((current) => [...(current ?? []), "b"]);
    });

    expect(latest(snapshots).data).toEqual(["a", "b"]);
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for very recent timestamps", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  it("formats minutes, hours, and days", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe("2d ago");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(timeAgo("not-a-date")).toBe("");
  });
});
