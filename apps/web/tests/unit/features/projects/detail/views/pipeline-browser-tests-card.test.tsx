import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { BrowserTestsCard } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-browser-tests-card";
import { useBrowserTestsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-browser-tests-view-model";
import {
  addProjectBrowserTests,
  getProjectBrowserTests,
} from "../../../../../../src/features/projects/detail/data/project-browser-tests-api";
import type { BrowserTestsStatus } from "../../../../../../src/features/projects/detail/model/browser-test-rules";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/projects/detail/data/project-browser-tests-api", () => ({
  getProjectBrowserTests: jest.fn(),
  addProjectBrowserTests: jest.fn(),
}));

const mockedStatus = getProjectBrowserTests as jest.MockedFunction<typeof getProjectBrowserTests>;
const mockedAdd = addProjectBrowserTests as jest.MockedFunction<typeof addProjectBrowserTests>;

const ALL_MISSING = [
  "playwright.config.ts",
  "tests/e2e/pages.e2e-spec.ts",
  "tests/e2e/links.e2e-spec.ts",
  "tests/e2e/a11y.e2e-spec.ts",
  "tests/e2e/visual.e2e-spec.ts",
  "tests/e2e/support.ts",
];

function status(overrides: Partial<BrowserTestsStatus> = {}): BrowserTestsStatus {
  return {
    installed: false,
    branch: "dev",
    missingFiles: ALL_MISSING,
    presentFiles: [],
    hasLockfile: true,
    playwrightVersion: null,
    canAdd: true,
    reason: null,
    ...overrides,
  };
}

function Harness({ onOpen }: Readonly<{ onOpen?: (n: number) => void }>) {
  const view = useBrowserTestsViewModel({ projectId: "p1" });
  return <BrowserTestsCard view={view} onOpenPullRequest={onOpen} />;
}

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(value: BrowserTestsStatus | Error, onOpen?: (n: number) => void) {
  if (value instanceof Error) mockedStatus.mockRejectedValue(value);
  else mockedStatus.mockResolvedValue(value);
  await act(async () => {
    root = createRoot(host);
    root.render(<Harness onOpen={onOpen} />);
  });
  await flush();
}

function addButton(): HTMLButtonElement | undefined {
  return [...host.querySelectorAll("button")].find((node) => node.textContent === "Add browser tests");
}

async function clickAdd() {
  await act(async () => addButton()!.click());
  await flush();
}

describe("Browser tests card", () => {
  it("reads the status once", async () => {
    await render(status());
    expect(mockedStatus).toHaveBeenCalledTimes(1);
    expect(mockedStatus).toHaveBeenCalledWith("p1");
  });

  it("is one quiet line when installed", async () => {
    await render(status({ installed: true, missingFiles: [], presentFiles: ALL_MISSING }));
    expect(host.textContent).toBe("Browser tests installed: page loads, links, accessibility, visual");
    expect(addButton()).toBeUndefined();
  });

  it("shows nothing when the read failed or the repository is not a frontend", async () => {
    await render(new Error("offline"));
    expect(host.querySelector("[data-browser-tests]")).toBeNull();
    act(() => root?.unmount());
    await render(
      status({
        canAdd: false,
        reason: "This repository does not look like a frontend project (no Next.js or React dependency in package.json).",
      }),
    );
    expect(host.querySelector("[data-browser-tests]")).toBeNull();
  });

  it("lists what is missing in plain words with the button", async () => {
    await render(status({ missingFiles: ["tests/e2e/visual.e2e-spec.ts", "tests/e2e/a11y.e2e-spec.ts"] }));
    expect([...host.querySelectorAll(".pipe-tests__missing li")].map((li) => li.textContent)).toEqual([
      "Accessibility",
      "Visual snapshots",
    ]);
    expect(addButton()).toBeDefined();
    expect(host.textContent).toContain("Opens a pull request into dev.");
  });

  it("shows the reason instead of the button when the role cannot add", async () => {
    await render(status({ canAdd: false, reason: "Your role cannot add browser tests to this project." }));
    expect(addButton()).toBeUndefined();
    expect(host.querySelector(".pipe-tests__reason")?.textContent).toBe(
      "Your role cannot add browser tests to this project.",
    );
  });

  it("opens the pull request, then links to it in the product with the notes", async () => {
    const onOpen = jest.fn();
    await render(status(), onOpen);
    let resolve: (value: Awaited<ReturnType<typeof addProjectBrowserTests>>) => void = () => undefined;
    mockedAdd.mockReturnValue(new Promise((done) => (resolve = done)));

    await act(async () => addButton()!.click());
    const pending = [...host.querySelectorAll("button")].find((node) => node.textContent === "Opening pull request…");
    expect(pending?.disabled).toBe(true);
    expect(pending?.getAttribute("aria-busy")).toBe("true");

    await act(async () =>
      resolve({
        pullRequestNumber: 12,
        branch: "alphaci/browser-tests",
        filesAdded: ["tests/e2e/pages.e2e-spec.ts"],
        filesSkipped: ["playwright.config.ts"],
        filesUpdated: [],
        notes: [
          "playwright.config.ts already exists and was not modified. Visual snapshots need this in its config:\n\n```ts\nexport default defineConfig({});\n```",
          "A lockfile exists, so package.json was left untouched.",
        ],
      }),
    );
    await flush();
    expect(mockedAdd).toHaveBeenCalledWith("p1");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Pull request #12 opened into dev.");
    const notes = [...host.querySelectorAll(".pipe-tests__notes > li")];
    expect(notes).toHaveLength(2);
    expect(notes[0]!.querySelector("pre")?.textContent).toBe("export default defineConfig({});");
    expect(notes[0]!.textContent).not.toContain("```");

    const link = host.querySelector<HTMLAnchorElement>('a[href="#pulls"]')!;
    expect(link.textContent).toBe("View pull request #12");
    await act(async () => link.click());
    expect(onOpen).toHaveBeenCalledWith(12);
    expect(host.querySelector('a[href*="github.com"]')).toBeNull();
  });

  it("links the pull request already open", async () => {
    const onOpen = jest.fn();
    await render(status(), onOpen);
    mockedAdd.mockRejectedValue(new ApiError("409", 409, { code: "BROWSER_TESTS_PR_OPEN", pullRequestNumber: 9 }));
    await clickAdd();
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("A browser-tests pull request is already open: #9");
    await act(async () => alert.querySelector<HTMLAnchorElement>('a[href="#pulls"]')!.click());
    expect(onOpen).toHaveBeenCalledWith(9);
  });

  it("asks to sign in again on GITHUB_REAUTH", async () => {
    await render(status());
    mockedAdd.mockRejectedValue(new ApiError("409", 409, { code: "GITHUB_REAUTH" }));
    await clickAdd();
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("GitHub needs you to sign in again");
    expect(alert.querySelector("a")?.getAttribute("href")).toBe("/login?next=/projects/p1");
    expect(addButton()).toBeDefined();
  });

  it.each([
    ["GITHUB_WRITE_FORBIDDEN", 403, "GitHub did not let your account write to this repository"],
    ["BROWSER_TESTS_NO_DEV_BRANCH", 409, "This repository has no dev branch yet"],
    ["BROWSER_TESTS_NOTHING_TO_ADD", 409, "already in this repository"],
    ["BROWSER_TESTS_BRANCH_TAKEN", 409, "branch name is already taken"],
    ["BROWSER_TESTS_NOT_FRONTEND", 422, "doesn't look like a frontend project"],
  ])("explains %s", async (code, statusCode, sentence) => {
    await render(status());
    mockedAdd.mockRejectedValue(new ApiError(String(statusCode), statusCode, { code }));
    await clickAdd();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(sentence);
    expect(host.querySelector('[role="alert"] a')).toBeNull();
  });

  it("drops the button once the server refuses the role", async () => {
    await render(status());
    mockedAdd.mockRejectedValue(new ApiError("403", 403, { code: "BROWSER_TESTS_ROLE_FORBIDDEN" }));
    await clickAdd();
    expect(addButton()).toBeUndefined();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Only developers, team leads and admins can add browser tests.",
    );
  });

  it("shows a refused pull request in the server's words", async () => {
    await render(status());
    mockedAdd.mockRejectedValue(
      new ApiError("409", 409, {
        code: "BROWSER_TESTS_PR_REFUSED",
        message: "The files were committed to alphaci/browser-tests, but GitHub refused the pull request: no commits",
      }),
    );
    await clickAdd();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("GitHub refused the pull request: no commits");
  });
});

describe("Browser tests card — visual testing off in the workflow", () => {
  type Access = "open" | "role" | "unavailable";

  function WorkflowHarness({
    access,
    onOpenWorkflow,
    workflowHref,
  }: Readonly<{ access: Access; onOpenWorkflow?: () => void; workflowHref?: string }>) {
    const view = useBrowserTestsViewModel({ projectId: "p1" });
    return <BrowserTestsCard view={view} workflowAccess={access} onOpenWorkflow={onOpenWorkflow} workflowHref={workflowHref} />;
  }

  async function renderWith(
    value: BrowserTestsStatus,
    access: Access,
    onOpenWorkflow?: () => void,
    workflowHref?: string,
  ) {
    mockedStatus.mockResolvedValue(value);
    await act(async () => {
      root = createRoot(host);
      root.render(<WorkflowHarness access={access} onOpenWorkflow={onOpenWorkflow} workflowHref={workflowHref} />);
    });
    await flush();
  }

  const INSTALLED = { installed: true, missingFiles: [], presentFiles: ALL_MISSING };

  function updateButton(): HTMLButtonElement | undefined {
    return [...host.querySelectorAll("button")].find((node) => node.textContent === "Update the workflow");
  }

  it("stays one quiet line for an older backend that does not report it", async () => {
    await renderWith(status(INSTALLED), "open", jest.fn());
    expect(host.textContent).toBe("Browser tests installed: page loads, links, accessibility, visual");
    expect(host.querySelector("[data-visual-off]")).toBeNull();
  });

  it("stays one quiet line when visual is on", async () => {
    await renderWith(status({ ...INSTALLED, visual: { dev: true, uat: true } }), "open", jest.fn());
    expect(host.querySelector("[data-visual-off]")).toBeNull();
  });

  it("says it is off and opens the Workflow tab's update pull request when dev is off", async () => {
    const onOpenWorkflow = jest.fn();
    await renderWith(status({ ...INSTALLED, visual: { dev: false, uat: false } }), "open", onOpenWorkflow);
    const notice = host.querySelector("[data-visual-off]");
    expect(notice?.querySelector(".pipe-tests__visual-line")?.textContent).toBe(
      "Visual testing is off in this repository's workflow.",
    );
    expect(host.textContent).toContain("Browser tests installed");
    act(() => updateButton()!.click());
    expect(onOpenWorkflow).toHaveBeenCalledTimes(1);
    expect(mockedAdd).not.toHaveBeenCalled();
    expect(host.innerHTML).not.toMatch(/github\.com/);
  });

  it("links another repository's Workflow tab inside the product", async () => {
    await renderWith(status({ ...INSTALLED, visual: { dev: false, uat: false } }), "open", undefined, "/projects/p2#workflow");
    const link = host.querySelector<HTMLAnchorElement>("[data-visual-off] a");
    expect(link?.textContent).toBe("Update the workflow");
    expect(link?.getAttribute("href")).toBe("/projects/p2#workflow");
  });

  it("says who can update it to a role that cannot", async () => {
    await renderWith(status({ ...INSTALLED, visual: { dev: false, uat: false } }), "role", jest.fn());
    expect(updateButton()).toBeUndefined();
    expect(host.querySelector("[data-visual-off] .pipe-tests__reason")?.textContent).toBe(
      "A Developer, Team lead or admin can open the workflow update pull request.",
    );
  });

  it("offers no action where the update pull request does not exist", async () => {
    await renderWith(status({ ...INSTALLED, visual: { dev: false, uat: false } }), "unavailable", jest.fn());
    expect(host.querySelector("[data-visual-off]")).not.toBeNull();
    expect(updateButton()).toBeUndefined();
    expect(host.querySelector("[data-visual-off] .pipe-tests__reason")).toBeNull();
  });

  it("says to promote when dev is on and uat is off", async () => {
    await renderWith(status({ ...INSTALLED, visual: { dev: true, uat: false } }), "open", jest.fn());
    expect(host.querySelector("[data-visual-off]")?.textContent).toBe(
      "Visual testing is off in this repository's workflow.Turned on in dev. Promote to uat to start capturing screenshots.",
    );
    expect(updateButton()).toBeUndefined();
  });

  it("keeps the missing-pack offer beside the notice", async () => {
    await renderWith(status({ visual: { dev: false, uat: false } }), "open", jest.fn());
    expect(addButton()).toBeDefined();
    expect(updateButton()).toBeDefined();
  });
});
