import type { AuthMeResponse } from "@/shared/api/contracts";
import {
  getAuthenticatedRedirectPath,
  isGuest,
  isInternalUser,
} from "@/features/auth/session";

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

describe("isGuest", () => {
  it("returns true for null or undefined session", () => {
    expect(isGuest(null)).toBe(true);
    expect(isGuest(undefined)).toBe(true);
  });

  it("returns true for unauthenticated session", () => {
    expect(isGuest(buildSession({ authenticated: false }))).toBe(true);
  });

  it("returns false for authenticated users even when subscription is not active", () => {
    expect(
      isGuest(buildSession({ subscription: { plan: "pro", status: "inactive", provider: "mock", updatedAt: "2026-01-01T00:00:00.000Z" } })),
    ).toBe(false);
  });

  it("returns false for authenticated users on the free plan", () => {
    expect(
      isGuest(buildSession({ subscription: { plan: "free", status: "active", provider: "mock", updatedAt: "2026-01-01T00:00:00.000Z" } })),
    ).toBe(false);
  });

  it("returns false for authenticated user with active paid plan", () => {
    expect(isGuest(buildSession())).toBe(false);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isGuest(buildSession({ subscription: { plan: "enterprise" as any, status: "active", provider: "mock", updatedAt: "2026-01-01T00:00:00.000Z" } })),
    ).toBe(false);
  });
});

describe("internal users", () => {
  const internalInactive = buildSession({
    user: { id: "u-int", login: "employee", isInternal: true },
    subscription: {
      plan: "free",
      status: "inactive",
      provider: "mock",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  it("isInternalUser reflects the session flag", () => {
    expect(isInternalUser(internalInactive)).toBe(true);
    expect(isInternalUser(buildSession())).toBe(false);
    expect(isInternalUser(null)).toBe(false);
  });

  it("routes internal users straight to the requested path", () => {
    expect(getAuthenticatedRedirectPath(internalInactive, "/home")).toBe("/home");
  });
});

describe("getAuthenticatedRedirectPath", () => {
  it("sends authenticated free users to the requested app path", () => {
    expect(
      getAuthenticatedRedirectPath(
        buildSession({
          subscription: {
            plan: "free",
            status: "active",
            provider: "mock",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        "/home",
      ),
    ).toBe("/home");
  });

  // The payment gateway was removed: entitlement is contract-granted, so there
  // is no paywall and no /subscribe route to divert anyone to.
  it("sends inactive paid users to the requested path rather than a paywall", () => {
    expect(
      getAuthenticatedRedirectPath(
        buildSession({
          subscription: {
            plan: "pro",
            status: "inactive",
            provider: "mock",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        "/home",
      ),
    ).toBe("/home");
  });

  it("returns null for unauthenticated users", () => {
    expect(
      getAuthenticatedRedirectPath(buildSession({ authenticated: false }), "/home"),
    ).toBeNull();
  });
});
