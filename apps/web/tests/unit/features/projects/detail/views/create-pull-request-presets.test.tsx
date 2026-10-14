import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CreatePullRequestView } from "../../../../../../src/features/projects/detail/views/workspace/create-pull-request-view";
import {
  compareProjectBranches,
  getProjectBranches,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectBranches: jest.fn(),
    compareProjectBranches: jest.fn(),
    createProjectPullRequest: jest.fn(),
  }),
);

const mockBranches = getProjectBranches as jest.MockedFunction<typeof getProjectBranches>;
const mockCompare = compareProjectBranches as jest.MockedFunction<typeof compareProjectBranches>;

describe("CreatePullRequestView presets", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    jest.resetAllMocks();
    host = document.createElement("div");
    document.body.appendChild(host);
    mockCompare.mockRejectedValue(new Error("not under test"));
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
  });

  async function render(names: string[], appRole: AppRole, viewerLogin = "lloyd") {
    mockBranches.mockResolvedValue({
      defaultBranch: "main",
      branches: names.map((name) => ({ name, protected: false, commitSha: "s" })),
    });
    await act(async () => {
      root = createRoot(host);
      root.render(
        <CreatePullRequestView
          projectId="p1"
          appRole={appRole}
          viewerLogin={viewerLogin}
          onCancel={() => undefined}
          onCreated={() => undefined}
          onViewExisting={() => undefined}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  function radios() {
    return [...host.querySelectorAll<HTMLInputElement>('[role="radiogroup"] input[type="radio"]')];
  }

  function selects() {
    return [...host.querySelectorAll<HTMLSelectElement>("select.ws-select")];
  }

  it("renders a labelled radiogroup with Feature -> Dev checked by default", async () => {
    await render(["dev", "uat", "feature/lloyd-a"], "lead");

    const group = host.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute("aria-label")).toBe("Pull request type");
    expect(radios().map((r) => r.parentElement?.textContent)).toEqual([
      "Feature → Dev",
      "Dev → UAT",
      "Custom",
    ]);
    expect(radios().map((r) => r.checked)).toEqual([true, false, false]);
    expect(radios().every((r) => !r.disabled)).toBe(true);
  });

  it("locks the base and never offers main", async () => {
    await render(["main", "dev", "uat", "feature/lloyd-a"], "lead");

    const [base] = selects();
    expect(base?.disabled).toBe(true);
    expect([...(base?.options ?? [])].map((o) => o.value)).not.toContain("main");
  });

  it("frees both pickers on Custom", async () => {
    await render(["dev", "uat", "feature/lloyd-a"], "lead");

    await act(async () => {
      radios()[2]?.click();
    });

    expect(radios().map((r) => r.checked)).toEqual([false, false, true]);
    expect(selects().every((s) => !s.disabled)).toBe(true);
  });

  it("disables a preset whose branch is missing and says why in text", async () => {
    await render(["dev", "feature/lloyd-a"], "lead");

    const devToUat = radios()[1];
    expect(devToUat?.disabled).toBe(true);
    const reasonId = devToUat?.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId ?? "")?.textContent).toContain("uat");
  });

  it("shows no preset group for QA", async () => {
    await render(["dev", "uat"], "qa");

    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
    expect(host.textContent).toContain("QA does not open pull requests.");
  });
});
