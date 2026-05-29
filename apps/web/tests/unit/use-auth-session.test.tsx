import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useAuthSession } from "../../src/hooks/use-auth-session";
import { ApiError, getAuthSession } from "../../src/lib/api/client";
import type { AuthMeResponse } from "../../src/lib/api/contracts";

jest.mock("../../src/lib/api/client", () => {
  const actual = jest.requireActual("../../src/lib/api/client");

  return {
    ...actual,
    getAuthSession: jest.fn(),
  };
});

const mockedGetAuthSession = getAuthSession as jest.MockedFunction<typeof getAuthSession>;

const baseSession: AuthMeResponse = {
  authenticated: true,
  user: {
    id: "user-1",
    login: "tone",
  },
  subscription: {
    plan: "pro",
    status: "active",
    provider: "mock",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

function buildSession(overrides: Partial<AuthMeResponse> = {}): AuthMeResponse {
  return {
    ...baseSession,
    ...overrides,
    user: {
      ...baseSession.user,
      ...overrides.user,
    },
    subscription: {
      ...baseSession.subscription,
      ...overrides.subscription,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

let latestSnapshot: ReturnType<typeof useAuthSession> | null = null;

function Probe() {
  const snapshot = useAuthSession();

  useEffect(() => {
    latestSnapshot = snapshot;
  });

  return null;
}

async function flushMicrotasks(cycles = 1) {
  for (let index = 0; index < cycles; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function waitForCondition(condition: () => boolean, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) {
      return;
    }

    await flushMicrotasks();
  }

  throw new Error("Condition not met in time.");
}

describe("useAuthSession", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latestSnapshot = null;
    mockedGetAuthSession.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function mountProbe() {
    await act(async () => {
      root.render(<Probe />);
    });

    await waitForCondition(() => latestSnapshot !== null);
  }

  it("loads a signed-in session when API confirms authentication", async () => {
    mockedGetAuthSession.mockResolvedValue(buildSession());

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "signed-in");

    expect(latestSnapshot?.session?.user.login).toBe("tone");
    expect(latestSnapshot?.error).toBeNull();
  });

  it("marks user as signed-out when API returns unauthenticated session", async () => {
    mockedGetAuthSession.mockResolvedValue(buildSession({ authenticated: false }));

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "signed-out");

    expect(latestSnapshot?.session).toBeNull();
    expect(latestSnapshot?.error).toBeNull();
  });

  it("marks user as signed-out for 401/403 session errors", async () => {
    mockedGetAuthSession.mockRejectedValue(new ApiError("Unauthorized", 401));

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "signed-out");

    expect(latestSnapshot?.session).toBeNull();
    expect(latestSnapshot?.error).toBeNull();
  });

  it("surfaces friendly message for unexpected session errors", async () => {
    mockedGetAuthSession.mockRejectedValue(new Error("Network broke"));

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "error");

    expect(latestSnapshot?.error).toBe("Unable to verify your session right now.");
  });

  it("refresh transitions from signed-out to signed-in", async () => {
    mockedGetAuthSession
      .mockResolvedValueOnce(buildSession({ authenticated: false }))
      .mockResolvedValueOnce(buildSession());

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "signed-out");

    await act(async () => {
      await latestSnapshot?.refresh();
    });

    await waitForCondition(() => latestSnapshot?.status === "signed-in");
    expect(latestSnapshot?.session?.authenticated).toBe(true);
  });

  it("refresh maps non-auth ApiError to explicit status message", async () => {
    mockedGetAuthSession
      .mockResolvedValueOnce(buildSession())
      .mockRejectedValueOnce(new ApiError("Server issue", 500));

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "signed-in");

    await act(async () => {
      await latestSnapshot?.refresh();
    });

    await waitForCondition(() => latestSnapshot?.status === "error");
    expect(latestSnapshot?.error).toBe("Session check failed with status 500.");
  });

  it("refresh marks signed-out for 403 errors", async () => {
    mockedGetAuthSession
      .mockResolvedValueOnce(buildSession())
      .mockRejectedValueOnce(new ApiError("Forbidden", 403));

    await mountProbe();
    await waitForCondition(() => latestSnapshot?.status === "signed-in");

    await act(async () => {
      await latestSnapshot?.refresh();
    });

    await waitForCondition(() => latestSnapshot?.status === "signed-out");
    expect(latestSnapshot?.session).toBeNull();
    expect(latestSnapshot?.error).toBeNull();
  });

  it("ignores stale initial request result when a newer refresh finishes first", async () => {
    const pendingInitial = createDeferred<AuthMeResponse>();

    mockedGetAuthSession
      .mockImplementationOnce(() => pendingInitial.promise)
      .mockResolvedValueOnce(buildSession());

    await mountProbe();
    expect(latestSnapshot?.status).toBe("loading");

    await act(async () => {
      await latestSnapshot?.refresh();
    });

    await waitForCondition(() => latestSnapshot?.status === "signed-in");

    await act(async () => {
      pendingInitial.resolve(buildSession({ authenticated: false }));
      await Promise.resolve();
    });

    expect(latestSnapshot?.status).toBe("signed-in");
    expect(latestSnapshot?.session?.authenticated).toBe(true);
  });
});