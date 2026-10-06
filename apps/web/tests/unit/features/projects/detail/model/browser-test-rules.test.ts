import {
  INSTALLED_LINE,
  browserTestsCardState,
  browserTestsError,
  missingChecks,
  openedLabel,
  splitNote,
  type BrowserTestsStatus,
} from "../../../../../../src/features/projects/detail/model/browser-test-rules";
import { ApiError } from "../../../../../../src/shared/api/request";

function status(overrides: Partial<BrowserTestsStatus> = {}): BrowserTestsStatus {
  return {
    installed: false,
    branch: "dev",
    missingFiles: [],
    presentFiles: [],
    hasLockfile: true,
    playwrightVersion: null,
    canAdd: true,
    reason: null,
    ...overrides,
  };
}

function conflict(body: Record<string, unknown>, statusCode = 409) {
  return new ApiError(`Request failed with status ${String(statusCode)}`, statusCode, body);
}

describe("which card shows", () => {
  it("is hidden until read, one line when installed, and the offer when missing", () => {
    expect(browserTestsCardState(null)).toBe("hidden");
    expect(browserTestsCardState(status({ installed: true }))).toBe("installed");
    expect(browserTestsCardState(status())).toBe("missing");
    expect(browserTestsCardState(status({ canAdd: false, reason: "Your role cannot add browser tests to this project." }))).toBe(
      "missing",
    );
    expect(INSTALLED_LINE).toBe("Browser tests installed: page loads, links, accessibility, visual");
  });

  it("trusts the explicit frontend flag over the reason's wording", () => {
    // A QA viewer on a backend repository: the reason reports the role first.
    expect(
      browserTestsCardState(
        status({ frontend: false, canAdd: false, reason: "Your role cannot add browser tests to this project." }),
      ),
    ).toBe("hidden");
    // Installed or not, a backend repository never shows the card.
    expect(browserTestsCardState(status({ frontend: false, installed: true }))).toBe("hidden");
    // The flag says frontend, so a reason that merely sounds similar does not hide it.
    expect(
      browserTestsCardState(
        status({ frontend: true, canAdd: false, reason: "This repository does not look like a frontend project." }),
      ),
    ).toBe("missing");
  });

  it("is hidden for a repository that is not a frontend", () => {
    expect(
      browserTestsCardState(
        status({
          canAdd: false,
          reason:
            "This repository does not look like a frontend project (no Next.js or React dependency in package.json).",
        }),
      ),
    ).toBe("hidden");
  });
});

describe("what is missing", () => {
  it("names the four checks and their setup in a fixed order", () => {
    expect(
      missingChecks([
        "playwright.config.ts",
        "tests/e2e/visual.e2e-spec.ts",
        "tests/e2e/support.ts",
        "tests/e2e/a11y.e2e-spec.ts",
        "tests/e2e/links.e2e-spec.ts",
        "tests/e2e/pages.e2e-spec.ts",
      ]),
    ).toEqual([
      "Page loads",
      "Links",
      "Accessibility",
      "Visual snapshots",
      "Shared test setup",
      "Playwright config",
    ]);
  });

  it("keeps a path it does not know", () => {
    expect(missingChecks(["tests/e2e/new.e2e-spec.ts", "tests/e2e/links.e2e-spec.ts"])).toEqual([
      "Links",
      "tests/e2e/new.e2e-spec.ts",
    ]);
  });
});

describe("after opening the pull request", () => {
  it("says where it went", () => {
    expect(openedLabel({ pullRequestNumber: 12 }, "dev")).toBe("Pull request #12 opened into dev");
  });

  it("lifts a fenced config snippet out of a note", () => {
    expect(
      splitNote(
        "playwright.config.ts already exists and was not modified. Visual snapshots need this in its config:\n\n```ts\nexport default defineConfig({\n  snapshotPathTemplate: 'x',\n});\n```",
      ),
    ).toEqual({
      text: "playwright.config.ts already exists and was not modified. Visual snapshots need this in its config:",
      code: "export default defineConfig({\n  snapshotPathTemplate: 'x',\n});",
    });
    expect(splitNote("  A lockfile exists.  ")).toEqual({ text: "A lockfile exists.", code: null });
  });
});

describe("an add that failed", () => {
  it("links the pull request already open", () => {
    expect(browserTestsError(conflict({ code: "BROWSER_TESTS_PR_OPEN", pullRequestNumber: 7 }), "p1")).toEqual({
      kind: "pr-open",
      message: "A browser-tests pull request is already open: #7",
      pullRequestNumber: 7,
      signInHref: null,
    });
  });

  it("maps GITHUB_REAUTH and a 401 to sign in again", () => {
    for (const cause of [conflict({ code: "GITHUB_REAUTH" }), new ApiError("401", 401, {})]) {
      expect(browserTestsError(cause, "p 1")).toEqual({
        kind: "reauth",
        message: "GitHub needs you to sign in again before ALPHACI can open this pull request.",
        pullRequestNumber: null,
        signInHref: "/login?next=/projects/p%201",
      });
    }
  });

  it.each([
    ["BROWSER_TESTS_ROLE_FORBIDDEN", 403, "forbidden", "Only developers, team leads and admins can add browser tests."],
    ["GITHUB_WRITE_FORBIDDEN", 403, "write-forbidden", "GitHub did not let your account write to this repository"],
    ["BROWSER_TESTS_NO_DEV_BRANCH", 409, "no-dev-branch", "This repository has no dev branch yet"],
    ["BROWSER_TESTS_NOTHING_TO_ADD", 409, "nothing-to-add", "already in this repository"],
    ["BROWSER_TESTS_BRANCH_TAKEN", 409, "branch-taken", "Every alphaci/browser-tests branch name is already taken"],
    ["BROWSER_TESTS_NOT_FRONTEND", 422, "not-frontend", "doesn't look like a frontend project"],
  ])("explains %s", (code, statusCode, kind, sentence) => {
    const error = browserTestsError(conflict({ code, message: "server text" }, statusCode), "p1");
    expect(error.kind).toBe(kind);
    expect(error.message).toContain(sentence);
    expect(error.pullRequestNumber).toBeNull();
    expect(error.signInHref).toBeNull();
  });

  it("uses the server's sentence for a refused pull request, and a fallback for the unknown", () => {
    expect(
      browserTestsError(
        conflict({ code: "BROWSER_TESTS_PR_REFUSED", message: "The files were committed to alphaci/browser-tests, but GitHub refused the pull request: x" }),
        "p1",
      ),
    ).toMatchObject({ kind: "pr-refused", message: "The files were committed to alphaci/browser-tests, but GitHub refused the pull request: x" });
    expect(browserTestsError(conflict({ code: "BROWSER_TESTS_PR_REFUSED" }), "p1").message).toBe(
      "The files were committed, but GitHub refused to open the pull request.",
    );
    expect(browserTestsError(new Error("offline"), "p1")).toMatchObject({
      kind: "failed",
      message: "The pull request could not be opened. Try again in a moment.",
    });
  });
});
