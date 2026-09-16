import { apiErrorReason } from "@/features/projects/detail/model/api-error-reason";
import { ApiError } from "@/shared/api/request";

const FALLBACK = "Unable to create workflow update PR.";

describe("apiErrorReason", () => {
  /*
   * The reason must come from `details`, not from `error.message`.
   * request.ts sets the message to "Request failed with status 400" and puts
   * the parsed body in details, so reading message would trade one useless
   * sentence for another — which is what the first version of this did.
   */
  it("reads the server's reason out of the response body", () => {
    const error = new ApiError("Request failed with status 400", 400, {
      statusCode: 400,
      message: "Workflow update pull requests are disabled",
      error: "Bad Request",
    });

    expect(apiErrorReason(error, FALLBACK)).toBe(
      "Workflow update pull requests are disabled",
    );
  });

  it("does not return the transport's own generic message", () => {
    const error = new ApiError("Request failed with status 400", 400, {
      statusCode: 400,
      message: "No usable GitHub token found.",
    });

    expect(apiErrorReason(error, FALLBACK)).not.toContain("Request failed");
  });

  it("joins the several reasons a validation failure gives", () => {
    // class-validator replies with one string per broken rule. A caller that
    // got three wrong wants three, not the first.
    const error = new ApiError("Request failed with status 400", 400, {
      statusCode: 400,
      message: ["nodeVersion must be a string", "servicePath should not be empty"],
    });

    const reason = apiErrorReason(error, FALLBACK);
    expect(reason).toContain("nodeVersion must be a string");
    expect(reason).toContain("servicePath should not be empty");
  });

  it("falls back when the body carries no message", () => {
    const error = new ApiError("Request failed with status 502", 502, {
      statusCode: 502,
    });

    expect(apiErrorReason(error, FALLBACK)).toBe(FALLBACK);
  });

  it("falls back when the body is not an object at all", () => {
    // An HTML error page from a proxy, for instance.
    const error = new ApiError("Request failed with status 504", 504, "<html>");

    expect(apiErrorReason(error, FALLBACK)).toBe(FALLBACK);
  });

  it("falls back for an error that never reached the API", () => {
    // A network failure is a TypeError, not an ApiError.
    expect(apiErrorReason(new TypeError("Failed to fetch"), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("falls back rather than showing an empty string", () => {
    const error = new ApiError("Request failed with status 400", 400, {
      message: "   ",
    });

    expect(apiErrorReason(error, FALLBACK)).toBe(FALLBACK);
  });
});

/*
 * The body the backend now sends when GitHub refuses to delete a repository.
 * It keeps the project and answers 409, and the page shows this message
 * instead of "verify permissions and try again" - which is what hid two
 * deletions GitHub had refused while the user believed them done.
 */
describe("apiErrorReason, for a refused GitHub repository delete", () => {
  const refused = (code: string, message: string) =>
    new ApiError("Request failed with status 409", 409, {
      statusCode: 409,
      error: "Conflict",
      code,
      message,
    });

  it("shows why GitHub refused, not a generic sentence", () => {
    const error = refused(
      "org_restricted",
      "The Alphaexplora-Sandbox organization restricts which apps can act on its repositories, and ALPHACI is not approved, so Alphaexplora-Sandbox/test was not deleted. The project was kept so you can try again.",
    );

    const shown = apiErrorReason(error, "The project could not be deleted.");

    expect(shown).toContain("restricts which apps");
    expect(shown).toContain("The project was kept");
  });

  it("falls back only when there is no reason to show", () => {
    const error = new ApiError("Request failed with status 409", 409, {});

    expect(apiErrorReason(error, "The project could not be deleted.")).toBe(
      "The project could not be deleted.",
    );
  });
});
