import { ApiError } from "../../../../../src/lib/api/request";
import {
  isExternalRepo,
  projectStatusVariant,
  toOverviewError,
} from "../../../../../src/features/projects/model/projects-rules";

/* These three decided what the project header showed and what a failed load
 * said, from inside a 550-line route where the only way to assert them was to
 * render the page. */

describe("projectStatusVariant", () => {
  it("maps the settled states", () => {
    expect(projectStatusVariant("provisioned")).toBe("provisioned");
    expect(projectStatusVariant("failed")).toBe("failed");
  });

  it("treats pending as still provisioning", () => {
    expect(projectStatusVariant("provisioning")).toBe("provisioning");
    expect(projectStatusVariant("pending")).toBe("provisioning");
  });

  it("falls back to failed for anything unrecognised", () => {
    expect(projectStatusVariant("orphaned")).toBe("failed");
    expect(projectStatusVariant("")).toBe("failed");
  });
});

describe("isExternalRepo", () => {
  it("claims nothing when the enforced org is unknown", () => {
    expect(isExternalRepo("acme/orders-api", undefined)).toBe(false);
    expect(isExternalRepo("acme/orders-api", "")).toBe(false);
  });

  it("is false inside the enforced org", () => {
    expect(isExternalRepo("acme/orders-api", "acme")).toBe(false);
  });

  it("compares the owner case-insensitively — GitHub logins are", () => {
    expect(isExternalRepo("ACME/orders-api", "acme")).toBe(false);
    expect(isExternalRepo("acme/orders-api", "ACME")).toBe(false);
  });

  it("is true for an owner outside the enforced org", () => {
    expect(isExternalRepo("other-co/orders-api", "acme")).toBe(true);
  });

  it("treats a bare name as external — it has no owner to match", () => {
    expect(isExternalRepo("orders-api", "acme")).toBe(true);
  });
});

describe("toOverviewError", () => {
  it("says disconnected on 404 rather than telling you to retry", () => {
    expect(toOverviewError(new ApiError("nope", 404))).toBe(
      "This project could not be found. It may have been disconnected.",
    );
  });

  it("offers a retry for every other API failure", () => {
    expect(toOverviewError(new ApiError("boom", 500))).toBe(
      "Could not load this project. Please retry.",
    );
  });

  it("offers a retry for a non-API throw", () => {
    expect(toOverviewError(new Error("network"))).toBe(
      "Could not load this project. Please retry.",
    );
  });
});
