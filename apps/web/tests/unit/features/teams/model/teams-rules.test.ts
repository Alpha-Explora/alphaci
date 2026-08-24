import {
  memberCountLabel,
  resolveSelectedTeam,
  toUserError,
} from "../../../../../src/features/teams/model/teams-rules";
import type { Team } from "../../../../../src/features/teams/model/teams-types";
import { ApiError } from "../../../../../src/shared/api/request";

function team(id: string, name = id): Team {
  return { id, name, memberCount: 1 } as Team;
}

describe("resolveSelectedTeam", () => {
  it("returns null when there are no teams", () => {
    expect(resolveSelectedTeam([], "a")).toBeNull();
    expect(resolveSelectedTeam(null, "a")).toBeNull();
  });

  it("returns the selected team when it is present", () => {
    const teams = [team("a"), team("b"), team("c")];
    expect(resolveSelectedTeam(teams, "b")?.id).toBe("b");
  });

  it("falls back to the first team when nothing is selected", () => {
    const teams = [team("a"), team("b")];
    expect(resolveSelectedTeam(teams, null)?.id).toBe("a");
  });

  it("falls back to the first team when the selection is stale", () => {
    // The header can still be offering a team that has since been deleted.
    const teams = [team("a"), team("b")];
    expect(resolveSelectedTeam(teams, "deleted")?.id).toBe("a");
  });

  it("never returns undefined for a non-empty list", () => {
    expect(resolveSelectedTeam([team("only")], "missing")).not.toBeUndefined();
  });
});

describe("memberCountLabel", () => {
  it("uses the singular for exactly one member", () => {
    expect(memberCountLabel(1)).toBe("1 member");
  });

  it("uses the plural otherwise", () => {
    expect(memberCountLabel(0)).toBe("0 members");
    expect(memberCountLabel(2)).toBe("2 members");
    expect(memberCountLabel(147)).toBe("147 members");
  });
});

describe("toUserError", () => {
  it("distinguishes an expired session", () => {
    expect(toUserError(new ApiError("nope", 401))).toMatch(/session expired/i);
  });

  it("distinguishes missing access", () => {
    expect(toUserError(new ApiError("nope", 403))).toMatch(/do not have access/i);
  });

  it("distinguishes a deleted team", () => {
    expect(toUserError(new ApiError("nope", 404))).toMatch(/no longer exists/i);
  });

  it("falls back for other API errors and non-API throws", () => {
    expect(toUserError(new ApiError("boom", 500))).toBe(
      "Could not load this team.",
    );
    expect(toUserError(new Error("offline"))).toBe("Could not load this team.");
    expect(toUserError(null)).toBe("Could not load this team.");
  });

  it("never leaks the underlying error text", () => {
    const leaky = new ApiError("token abc123 rejected by upstream", 500);
    expect(toUserError(leaky)).not.toMatch(/abc123/);
  });
});
