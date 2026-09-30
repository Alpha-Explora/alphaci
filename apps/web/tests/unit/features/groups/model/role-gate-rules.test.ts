import {
  canWriteRepositoryConfiguration,
  roleGateMessage,
} from "../../../../../src/features/groups/model/role-gate-rules";
import { ApiError } from "../../../../../src/shared/api/request";

function apiError(status: number, code?: string): ApiError {
  return new ApiError(`Request failed with status ${status}`, status, {
    statusCode: status,
    error: "x",
    ...(code ? { code } : {}),
    message: "server text",
  });
}

describe("canWriteRepositoryConfiguration", () => {
  it.each([
    ["admin", true],
    ["lead", true],
    ["member", false],
    ["qa", false],
    [undefined, false],
    [null, false],
  ] as const)("%s -> %s", (role, expected) => {
    expect(canWriteRepositoryConfiguration(role)).toBe(expected);
  });
});

describe("roleGateMessage", () => {
  it.each([
    [
      403,
      "ENV_VARS_LEAD_ONLY",
      "Only team leads and admins can change repository variables and secrets.",
    ],
    [
      400,
      "ASSIGNMENT_ROLE_NOT_ALLOWED",
      "Only Developers are assigned repositories; QA and leads already see every repository in the team.",
    ],
  ])("maps %s %s", (status, code, expected) => {
    expect(roleGateMessage(apiError(status, code))).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(roleGateMessage(apiError(403, "env_vars_lead_only"))).not.toBeNull();
  });

  it("returns null for unknown codes, missing codes and non-API errors", () => {
    expect(roleGateMessage(apiError(403, "OTHER"))).toBeNull();
    expect(roleGateMessage(apiError(403))).toBeNull();
    expect(roleGateMessage(new Error("x"))).toBeNull();
  });
});
