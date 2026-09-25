import {
  canAccessAdmin,
  describeRoleError,
  isSuperAdmin,
  NEXT_FEEDBACK_STATUS,
  ROLE_ORDER,
} from "../../../../../src/features/admin/model/admin-rules";
import { ApiError } from "../../../../../src/shared/api/request";

describe("admin access rules", () => {
  it("grants access to app-role admins", () => {
    expect(canAccessAdmin({ authenticated: true, appRole: "admin" })).toBe(true);
  });

  it("grants access to super admins", () => {
    expect(canAccessAdmin({ authenticated: true, platformRole: "super_admin" })).toBe(true);
  });

  it("denies leads and members even with a legacy platform-admin row", () => {
    expect(canAccessAdmin({ authenticated: true, appRole: "lead", platformRole: "admin" })).toBe(false);
    expect(canAccessAdmin({ authenticated: true, appRole: "member" })).toBe(false);
  });

  it("denies signed-out users", () => {
    expect(canAccessAdmin(null)).toBe(false);
    expect(canAccessAdmin({ authenticated: false, appRole: "admin" })).toBe(false);
  });

  it("identifies super admins only", () => {
    expect(isSuperAdmin({ platformRole: "super_admin" })).toBe(true);
    expect(isSuperAdmin({ platformRole: "admin" })).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("orders roles most-privileged first", () => {
    expect(ROLE_ORDER).toEqual(["admin", "lead", "qa", "member"]);
  });
});

describe("feedback triage cycle", () => {
  it("advances every status and wraps from dismissed", () => {
    expect(NEXT_FEEDBACK_STATUS.open).toBe("in_review");
    expect(NEXT_FEEDBACK_STATUS.in_review).toBe("resolved");
    expect(NEXT_FEEDBACK_STATUS.resolved).toBe("dismissed");
    expect(NEXT_FEEDBACK_STATUS.dismissed).toBe("open");
  });
});

describe("describeRoleError", () => {
  it("prefers the backend message", () => {
    const cause = new ApiError("nope", 400, { message: "last admin" });
    expect(describeRoleError(cause)).toBe("last admin");
  });

  it("special-cases 403", () => {
    const cause = new ApiError("forbidden", 403);
    expect(describeRoleError(cause)).toBe("you need platform-admin access.");
  });

  it("falls back for unknown errors", () => {
    expect(describeRoleError(new Error("boom"))).toBe("unexpected error. Please try again.");
  });
});
