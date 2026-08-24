import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useAuthSession } from "@/features/auth/session";
import type { AuthMeResponse } from "../../src/shared/api/contracts";

/* ── Mocks ───────────────────────────────────────────────────────────────── */

const mockGetAuthSession = jest.fn();

class MockApiError extends Error {
  constructor(public readonly status: number) {
    super(`status ${status}`);
  }
}

jest.mock("../../../../../../src/features/auth/session/data/auth-api", () => ({
  getAuthSession: (...args: unknown[]) => mockGetAuthSession(...args),
  ApiError: class extends Error {
    constructor(public readonly status: number) {
      super(`status ${status}`);
    }
  },
}));

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function makeSession(appRole: "admin" | "lead" | "member"): AuthMeResponse {
  return {
    authenticated: true,
    user: { id: "u1", login: "ada" },
    subscription: { plan: "pro", status: "active" },
    appRole,
    appRoleSource: "github_team",
  } as unknown as AuthMeResponse;
}

interface Harness {
  latest: ReturnType<typeof useAuthSession> | null;
}

function renderHook(): { harness: Harness; root: Root; container: HTMLElement } {
  const harness: Harness = { latest: null };

  // The hook result is published through an effect rather than assigned during
  // render: react-hooks/immutability forbids mutating outer scope in a render
  // body, and an effect is also the only point where the value is committed.
  function Probe() {
    const session = useAuthSession();
    useEffect(() => {
      harness.latest = session;
    });
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
  return { harness, root, container };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe("useAuthSession — role refresh on focus", () => {
  beforeEach(() => {
    mockGetAuthSession.mockReset();
  });

  it("picks up a role change when the tab regains focus", async () => {
    // A developer promoted to team-lead in GitHub while this tab sat open.
    mockGetAuthSession
      .mockResolvedValueOnce(makeSession("member"))
      .mockResolvedValueOnce(makeSession("lead"));

    const { harness, root } = renderHook();
    await flush();
    expect(harness.latest?.session?.appRole).toBe("member");

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    await flush();

    expect(harness.latest?.session?.appRole).toBe("lead");
    // The whole point of the background refresh: it must NOT bounce the UI
    // through a loading state on every tab switch.
    expect(harness.latest?.status).toBe("signed-in");

    act(() => root.unmount());
  });

  it("keeps the current session when the background refresh fails", async () => {
    mockGetAuthSession
      .mockResolvedValueOnce(makeSession("lead"))
      .mockRejectedValueOnce(new MockApiError(500));

    const { harness, root } = renderHook();
    await flush();
    expect(harness.latest?.session?.appRole).toBe("lead");

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    await flush();

    // A transient failure must never sign the user out or surface an error —
    // the next real request will handle a genuinely dead session.
    expect(harness.latest?.status).toBe("signed-in");
    expect(harness.latest?.session?.appRole).toBe("lead");
    expect(harness.latest?.error).toBeNull();

    act(() => root.unmount());
  });

  it("stops refreshing once unmounted", async () => {
    mockGetAuthSession.mockResolvedValue(makeSession("member"));

    const { root } = renderHook();
    await flush();
    const callsWhileMounted = mockGetAuthSession.mock.calls.length;

    act(() => root.unmount());

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(mockGetAuthSession.mock.calls).toHaveLength(callsWhileMounted);
  });
});
