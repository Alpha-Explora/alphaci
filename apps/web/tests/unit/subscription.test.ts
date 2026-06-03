import type { AuthMeResponse } from "@/lib/api/contracts";
import { hasActiveSubscription, isGuest } from "@/lib/auth/subscription";

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

describe("hasActiveSubscription", () => {
  it("returns false for missing session", () => {
    expect(hasActiveSubscription(null)).toBe(false);
    expect(hasActiveSubscription(undefined)).toBe(false);
  });

  it("returns false for unauthenticated users", () => {
    expect(hasActiveSubscription(buildSession({ authenticated: false }))).toBe(false);
  });

  it("returns false for active free plan", () => {
    expect(
      hasActiveSubscription(
        buildSession({
          subscription: {
            plan: "free",
            status: "active",
            provider: "mock",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(false);
  });

  it("returns false for inactive paid plan", () => {
    expect(
      hasActiveSubscription(
        buildSession({
          subscription: {
            plan: "pro",
            status: "inactive",
            provider: "mock",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(false);
  });

  it("returns true for active paid plans", () => {
    expect(
      hasActiveSubscription(
        buildSession({
          subscription: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plan: "enterprise" as any,
            status: "active",
            provider: "mock",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("isGuest", () => {
  it("returns true for null or undefined session", () => {
    expect(isGuest(null)).toBe(true);
    expect(isGuest(undefined)).toBe(true);
  });

  it("returns true for unauthenticated session", () => {
    expect(isGuest(buildSession({ authenticated: false }))).toBe(true);
  });

  it("returns true when subscription is not active", () => {
    expect(
      isGuest(buildSession({ subscription: { plan: "pro", status: "inactive", provider: "mock", updatedAt: "2026-01-01T00:00:00.000Z" } })),
    ).toBe(true);
  });

  it("returns true when authenticated but on free plan", () => {
    expect(
      isGuest(buildSession({ subscription: { plan: "free", status: "active", provider: "mock", updatedAt: "2026-01-01T00:00:00.000Z" } })),
    ).toBe(true);
  });

  it("returns false for authenticated user with active paid plan", () => {
    expect(isGuest(buildSession())).toBe(false);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isGuest(buildSession({ subscription: { plan: "enterprise" as any, status: "active", provider: "mock", updatedAt: "2026-01-01T00:00:00.000Z" } })),
    ).toBe(false);
  });
});