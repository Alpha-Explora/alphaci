import { ApiError } from "../../../../../src/lib/api/request";
import type { ProjectBranchPreview } from "../../../../../src/lib/api/contracts";
import {
  canFramePreview,
  isExternalRepo,
  previewKey,
  previewStatusLabel,
  previewStatusTone,
  previewUnavailableReason,
  projectStatusVariant,
  shortCommitSha,
  toOverviewError,
} from "../../../../../src/features/projects/model/projects-rules";

function preview(
  overrides: Partial<ProjectBranchPreview> = {},
): ProjectBranchPreview {
  return {
    branch: "feat/checkout",
    isProduction: false,
    deploymentId: "dpl_1",
    targetId: "target-1",
    targetName: "web-app",
    provider: "vercel",
    status: "ready",
    commitSha: "ea738449c1d",
    commitMessage: "feat: checkout",
    pullRequestNumber: 42,
    previewUrl: "https://web-app-git-feat-checkout.vercel.app",
    inspectorUrl: "https://vercel.com/tone/web-app/dpl_1",
    createdAt: "2026-07-12T11:45:00.000Z",
    readyAt: "2026-07-12T11:48:00.000Z",
    embeddable: true,
    embedBlockedReason: null,
    ...overrides,
  };
}

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

describe("previewStatusTone", () => {
  it("treats a live deployment as ok", () => {
    expect(previewStatusTone("ready")).toBe("ok");
  });

  it("treats an unfinished deployment as pending", () => {
    expect(previewStatusTone("queued")).toBe("pending");
    expect(previewStatusTone("building")).toBe("pending");
    expect(previewStatusTone("unknown")).toBe("pending");
  });

  it("treats a failed or abandoned deployment as danger", () => {
    expect(previewStatusTone("failed")).toBe("danger");
    expect(previewStatusTone("canceled")).toBe("danger");
  });
});

describe("previewStatusLabel", () => {
  it("calls a ready deployment Live rather than echoing the provider word", () => {
    expect(previewStatusLabel("ready")).toBe("Live");
  });

  it("labels every status", () => {
    expect(previewStatusLabel("queued")).toBe("Queued");
    expect(previewStatusLabel("building")).toBe("Building");
    expect(previewStatusLabel("failed")).toBe("Failed");
    expect(previewStatusLabel("canceled")).toBe("Canceled");
    expect(previewStatusLabel("unknown")).toBe("Unknown");
  });
});

/* The framing decision is the whole safety story for the preview: a browser
 * fires no error event when X-Frame-Options refuses an embed, so anything less
 * than a confirmed verdict has to fall back rather than render a blank box. */
describe("canFramePreview", () => {
  it("frames a live, confirmed-embeddable deployment", () => {
    expect(canFramePreview(preview())).toBe(true);
  });

  it("refuses when the site was found to block framing", () => {
    expect(canFramePreview(preview({ embeddable: false }))).toBe(false);
  });

  it("refuses when embeddability could not be determined", () => {
    expect(canFramePreview(preview({ embeddable: null }))).toBe(false);
  });

  it("refuses a deployment that is not live yet", () => {
    expect(canFramePreview(preview({ status: "building" }))).toBe(false);
    expect(canFramePreview(preview({ status: "failed" }))).toBe(false);
  });

  it("refuses when there is no URL to frame", () => {
    expect(canFramePreview(preview({ previewUrl: null }))).toBe(false);
  });
});

describe("previewUnavailableReason", () => {
  it("says a building branch will resolve itself", () => {
    expect(previewUnavailableReason(preview({ status: "building" }))).toContain(
      "still deploying",
    );
    expect(previewUnavailableReason(preview({ status: "queued" }))).toContain(
      "still deploying",
    );
  });

  it("says a failed deployment has nothing to show", () => {
    expect(previewUnavailableReason(preview({ status: "failed" }))).toContain(
      "did not finish",
    );
    expect(previewUnavailableReason(preview({ status: "canceled" }))).toContain(
      "did not finish",
    );
  });

  it("prefers the provider's own reason when framing was refused", () => {
    expect(
      previewUnavailableReason(
        preview({
          embeddable: false,
          embedBlockedReason: "The site sends X-Frame-Options: DENY.",
        }),
      ),
    ).toBe("The site sends X-Frame-Options: DENY.");
  });

  it("falls back to a generic reason when none was given", () => {
    expect(
      previewUnavailableReason(
        preview({ embeddable: false, embedBlockedReason: null }),
      ),
    ).toContain("cannot be shown inline");
  });

  it("calls out a missing URL ahead of the embedding reason", () => {
    expect(
      previewUnavailableReason(
        preview({ previewUrl: null, embedBlockedReason: "irrelevant" }),
      ),
    ).toContain("did not report a URL");
  });
});

describe("previewKey", () => {
  it("keeps the same branch distinct per deployment target", () => {
    const frontend = preview({ targetId: "target-fe", branch: "main" });
    const backend = preview({ targetId: "target-be", branch: "main" });

    expect(previewKey(frontend)).not.toBe(previewKey(backend));
  });
});

describe("shortCommitSha", () => {
  it("shortens to seven characters", () => {
    expect(shortCommitSha("ea738449c1d")).toBe("ea73844");
  });

  it("passes through a null sha rather than rendering 'null'", () => {
    expect(shortCommitSha(null)).toBeNull();
  });
});
