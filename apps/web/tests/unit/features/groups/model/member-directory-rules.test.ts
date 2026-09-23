import {
  describeAddMemberError,
  describeDirectoryError,
  emptyDirectoryMessage,
  serverErrorMessage,
} from "../../../../../src/features/groups/model/member-directory-rules";

const apiError = (status: number, details?: unknown) => ({ status, details });

describe("member directory wording", () => {
  it("prefers the server's explanation of an unreadable directory", () => {
    const reason =
      "The Alpha-Explora GitHub organization could not be read. Sign out and sign in again to refresh your GitHub access.";

    expect(describeDirectoryError(apiError(503, { message: reason }))).toBe(reason);
  });

  it("falls back to a generic line when the server gives no reason", () => {
    expect(describeDirectoryError(apiError(500))).toBe(
      "The organization member list is unavailable. Please try again.",
    );
    expect(describeDirectoryError(new Error("network"))).toBe(
      "The organization member list is unavailable. Please try again.",
    );
  });

  it("names a refused lookup as a permissions problem", () => {
    expect(describeDirectoryError(apiError(403, { message: "Forbidden" }))).toBe(
      "Only a group lead can add members.",
    );
  });

  it("keeps the server's reason for a refused add, joining validation lists", () => {
    expect(
      describeAddMemberError(
        apiError(404, {
          message: "outsider is not a member of the Alpha-Explora GitHub organization.",
        }),
      ),
    ).toBe("outsider is not a member of the Alpha-Explora GitHub organization.");
    expect(
      describeAddMemberError(apiError(400, { message: ["userId must be a UUID", "role is invalid"] })),
    ).toBe("userId must be a UUID, role is invalid");
  });

  it("reports an unexplained add failure with its status", () => {
    expect(describeAddMemberError(apiError(502))).toBe("The member could not be added (502).");
    expect(describeAddMemberError(apiError(403))).toBe(
      "You're not allowed to add members to this group.",
    );
    expect(describeAddMemberError("boom")).toBe("The member could not be added. Please try again.");
  });

  it("ignores details that carry no usable message", () => {
    expect(serverErrorMessage(apiError(500, { message: "   " }))).toBeNull();
    expect(serverErrorMessage(apiError(500, { message: [42] }))).toBeNull();
    expect(serverErrorMessage(apiError(500, null))).toBeNull();
  });

  it("says why the list is empty", () => {
    expect(emptyDirectoryMessage("  ramos ")).toBe('No organization members match "ramos".');
    expect(emptyDirectoryMessage("")).toBe("Everyone in the organization is already in this group.");
  });
});
