import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProductionDeploymentView } from "../../../../../src/features/projects/previews";
import type {
  ProjectBranchPreview,
  ProjectPreviewsResponse,
} from "../../../../../src/shared/api/contracts";

function production(
  overrides: Partial<ProjectBranchPreview> = {},
): ProjectBranchPreview {
  return {
    branch: "main",
    isProduction: true,
    deploymentId: "dpl_1",
    targetId: "target-1",
    targetName: "web-app",
    provider: "vercel",
    status: "ready",
    commitSha: "4b84b6b0c1d",
    commitMessage: "Merge pull request #44",
    pullRequestNumber: null,
    createdBy: "LloydLim1",
    previewUrl: "https://web-app.vercel.app",
    deploymentUrl: "https://web-app-95qebabj0-tone.vercel.app",
    inspectorUrl: "https://vercel.com/tone/web-app/dpl_1",
    createdAt: "2026-07-12T11:45:00.000Z",
    readyAt: "2026-07-12T11:48:00.000Z",
    embeddable: true,
    embedBlockedReason: null,
    ...overrides,
  };
}

function response(branches: ProjectBranchPreview[]): ProjectPreviewsResponse {
  return {
    enabled: true,
    liveProvidersEnabled: true,
    branches,
    providerError: null,
  };
}

describe("ProductionDeploymentView", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  function render(branches: ProjectBranchPreview[]) {
    root = createRoot(container);
    act(() => {
      root?.render(
        <ProductionDeploymentView
          error={null}
          previews={response(branches)}
          repoFullName="tone/web-app"
          status="ready"
        />,
      );
    });
  }

  function link(name: string) {
    return Array.from(container.querySelectorAll("a")).find(
      (anchor) =>
        anchor.textContent?.includes(name) ||
        anchor.getAttribute("aria-label")?.includes(name),
    );
  }

  it("lays the production environment out as a deployment card", () => {
    render([production()]);

    const text = container.textContent ?? "";
    expect(text).toContain("Production Deployment");
    expect(text).toContain("web-app-95qebabj0-tone.vercel.app");
    expect(text).toContain("web-app.vercel.app");
    expect(text).toContain("Live");
    expect(text).toContain("by LloydLim1");
    expect(text).toContain("main");
    expect(text).toContain("4b84b6b");
    expect(text).toContain("Merge pull request #44");
  });

  it("links the commit on GitHub, the build logs and the live site", () => {
    render([production()]);

    expect(link("View commit on GitHub")?.getAttribute("href")).toBe(
      "https://github.com/tone/web-app/commit/4b84b6b0c1d",
    );
    expect(link("Build logs")?.getAttribute("href")).toBe(
      "https://vercel.com/tone/web-app/dpl_1",
    );
    expect(link("Visit")?.getAttribute("href")).toBe(
      "https://web-app.vercel.app",
    );
  });

  /* The security-relevant assertions, as for the full viewport: the fixture
   * is cross-origin to jsdom's localhost, so it keeps its real origin, and it
   * still may never navigate the dashboard. */
  it("frames the stable address as an inert, sandboxed thumbnail", () => {
    render([production()]);

    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("https://web-app.vercel.app");
    expect(frame?.getAttribute("sandbox")).toContain("allow-scripts");
    expect(frame?.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(frame?.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame?.hasAttribute("inert")).toBe(true);
    expect(link("Open web-app.vercel.app")).toBeDefined();
  });

  it("explains, rather than frames, an address behind deployment protection", () => {
    render([
      production({
        embeddable: false,
        embedBlockedReason:
          "This deployment is behind deployment protection, so it cannot be shown inline.",
      }),
    ]);

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("behind deployment protection");
  });

  it("shows an undeployed production address as text, with nothing to visit", () => {
    render([
      production({
        status: "not_deployed",
        deploymentId: null,
        deploymentUrl: null,
        commitSha: null,
        commitMessage: null,
        createdAt: null,
        createdBy: null,
        readyAt: null,
        embeddable: false,
      }),
    ]);

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe(
      "web-app.vercel.app",
    );
    expect(link("Visit")).toBeUndefined();
    expect(link("Provider dashboard")).toBeDefined();
    expect(container.textContent).toContain("Nothing deployed yet");
  });

  it("lists the other branches as one-line rows under a single card", () => {
    render([
      production(),
      production({
        isProduction: false,
        branch: "feat/org-member-directory",
        deploymentId: "dpl_2",
        commitSha: "3fjeeb0a1",
        commitMessage: "feat(groups): list workspace candidates",
        pullRequestNumber: 47,
        previewUrl: "https://web-app-git-feat-org.vercel.app",
      }),
    ]);

    expect(container.querySelectorAll("article")).toHaveLength(1);
    const rows = container.querySelectorAll(".active-branch");
    expect(rows).toHaveLength(1);
    const row = rows[0]?.textContent ?? "";
    expect(row).toContain("feat/org-member-directory");
    expect(row).toContain("Live");
    expect(row).toContain("3fjeeb0");
    expect(row).toContain("#47");
    expect(link("#47")?.getAttribute("href")).toBe(
      "https://github.com/tone/web-app/pull/47",
    );
    expect(link("Visit web-app-git-feat-org.vercel.app")).toBeDefined();
  });

  /* The production screen that prompted this: a failed deployment of a
   * feature branch that Vercel also called production drew a second card. */
  it("never draws a second card for the same target", () => {
    render([
      production(),
      production({
        branch: "feat/cicd-system-validation",
        deploymentId: "dpl_3",
        status: "failed",
      }),
    ]);

    expect(container.querySelectorAll("article")).toHaveLength(1);
    const row = container.querySelector(".active-branch")?.textContent ?? "";
    expect(row).toContain("feat/cicd-system-validation");
    expect(row).toContain("Failed");
    expect(link("Visit web-app.vercel.app")).toBeUndefined();
  });

  it("leaves rows past the limit to the Hosting tab", () => {
    const others = Array.from({ length: 7 }, (_, index) =>
      production({
        isProduction: false,
        branch: `feat/branch-${index}`,
        deploymentId: `dpl_${index + 10}`,
      }),
    );
    render([production(), ...others]);

    expect(container.querySelectorAll(".active-branch")).toHaveLength(5);
    expect(container.textContent).toContain("2 more branches on the Hosting tab.");
  });

  it("falls back to the branch list when there is no production environment", () => {
    render([production({ isProduction: false, branch: "uat" })]);

    expect(container.textContent).not.toContain("Production Deployment");
    expect(container.textContent).toContain("Branch previews");
    expect(container.textContent).toContain("uat");
  });
});
