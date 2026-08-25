import {
  accountActionErrorMessage,
  failedContent,
  providerDisplayName,
  statusMessage,
  toSafeNextPath,
  toSafeProvider,
} from "../../../../../../src/features/auth/callback/model/callback-rules";

describe("auth callback rules", () => {
  it("keeps safe internal next paths and rejects protocol-relative redirects", () => {
    expect(toSafeNextPath("/projects/p-1")).toBe("/projects/p-1");
    expect(toSafeNextPath("//attacker.example")).toBe("/home");
    expect(toSafeNextPath(null)).toBe("/home");
  });

  it("normalizes providers and exposes their display names", () => {
    expect(toSafeProvider("google")).toBe("google");
    expect(toSafeProvider("unknown")).toBe("github");
    expect(providerDisplayName("github")).toBe("GitHub");
  });

  it("keeps reason-specific status and invitation copy", () => {
    expect(statusMessage("not_authorized", "github")).toContain("members");
    expect(failedContent("org_invite_pending", "ignored", "alpha-explora")).toMatchObject({
      ghost: "INVITE",
      actionHref: "https://github.com/orgs/alpha-explora/invitation",
    });
    expect(
      failedContent("org_invite_pending", "ignored", "bad/org").actionHref,
    ).toBe("https://github.com/settings/organizations");
  });

  it("preserves safe account-action error messages", () => {
    expect(accountActionErrorMessage({ status: 409 }, "restore")).toBe(
      "Restore failed (409). Please try again.",
    );
    expect(accountActionErrorMessage(new Error("network"), "start-fresh")).toBe(
      "Could not start fresh. Please try again.",
    );
  });
});
