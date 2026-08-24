import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { BranchPreviewsView } from "../../../../../src/features/projects/previews";
import type {
  ProjectBranchPreview,
  ProjectPreviewsResponse,
} from "../../../../../src/lib/api/contracts";

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

function response(
  overrides: Partial<ProjectPreviewsResponse> = {},
): ProjectPreviewsResponse {
  return {
    enabled: true,
    liveProvidersEnabled: true,
    branches: [preview()],
    ...overrides,
  };
}

describe("BranchPreviewsView", () => {
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

  function render(node: React.ReactElement) {
    act(() => {
      root = createRoot(container);
      root.render(node);
    });
  }

  it("renders one card per branch", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({
          branches: [
            preview({ branch: "main", targetId: "t1" }),
            preview({ branch: "feat/x", targetId: "t1" }),
          ],
        })}
        status="ready"
      />,
    );

    expect(container.querySelectorAll(".branch-preview")).toHaveLength(2);
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("feat/x");
  });

  it("frames a confirmed-embeddable live deployment", () => {
    render(
      <BranchPreviewsView error={null} previews={response()} status="ready" />,
    );

    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("src")).toBe(
      "https://web-app-git-feat-checkout.vercel.app",
    );
  });

  /* The security-relevant assertions. allow-same-origin alongside
   * allow-scripts would let the framed customer page escape the sandbox. */
  it("sandboxes the frame without allow-same-origin", () => {
    render(
      <BranchPreviewsView error={null} previews={response()} status="ready" />,
    );

    const sandbox = container.querySelector("iframe")?.getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("does not frame a site that blocks embedding, and explains why", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({
          branches: [
            preview({
              embeddable: false,
              embedBlockedReason: "The site sends X-Frame-Options: DENY.",
            }),
          ],
        })}
        status="ready"
      />,
    );

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("X-Frame-Options: DENY");
  });

  it("does not frame a deployment whose embeddability is unknown", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({
          branches: [preview({ embeddable: null })],
        })}
        status="ready"
      />,
    );

    expect(container.querySelector("iframe")).toBeNull();
  });

  it("still offers the link when the site cannot be framed", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({
          branches: [preview({ embeddable: false })],
        })}
        status="ready"
      />,
    );

    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="https://web-app-git-feat-checkout.vercel.app"]',
    );
    expect(link).not.toBeNull();
    expect(link?.rel).toContain("noreferrer");
  });

  it("marks the production branch", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({
          branches: [preview({ branch: "main", isProduction: true })],
        })}
        status="ready"
      />,
    );

    expect(container.querySelector(".branch-preview__badge")?.textContent).toBe(
      "Production",
    );
  });

  it("shows the pull request when the deployment came from one", () => {
    render(
      <BranchPreviewsView error={null} previews={response()} status="ready" />,
    );

    expect(container.textContent).toContain("PR #42");
  });

  it("omits the pull request line when there is none", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({
          branches: [preview({ pullRequestNumber: null })],
        })}
        status="ready"
      />,
    );

    expect(container.textContent).not.toContain("PR #");
  });

  it("tells the reader to push a branch when nothing is deployed", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({ branches: [] })}
        status="ready"
      />,
    );

    expect(container.textContent).toContain("Push a branch");
  });

  it("asks for a provider when none is connected", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({ liveProvidersEnabled: false })}
        status="ready"
      />,
    );

    expect(container.textContent).toContain("Connect a hosting provider");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("reports the feature being switched off", () => {
    render(
      <BranchPreviewsView
        error={null}
        previews={response({ enabled: false })}
        status="ready"
      />,
    );

    expect(container.textContent).toContain("not enabled");
  });

  it("renders the error message rather than the list", () => {
    render(
      <BranchPreviewsView
        error="Could not load branch previews. Please retry."
        previews={null}
        status="error"
      />,
    );

    expect(container.textContent).toContain("Could not load branch previews");
    expect(container.querySelector(".branch-preview")).toBeNull();
  });

  it("shows a loading state before the first response", () => {
    render(
      <BranchPreviewsView error={null} previews={null} status="loading" />,
    );

    expect(container.textContent).toContain("Loading branch previews");
  });

  it("caps the list at the limit and says where the rest are", () => {
    render(
      <BranchPreviewsView
        error={null}
        limit={1}
        moreHref="the Hosting tab"
        previews={response({
          branches: [
            preview({ branch: "main", targetId: "t1" }),
            preview({ branch: "feat/x", targetId: "t1" }),
            preview({ branch: "feat/y", targetId: "t1" }),
          ],
        })}
        status="ready"
      />,
    );

    expect(container.querySelectorAll(".branch-preview")).toHaveLength(1);
    expect(container.textContent).toContain("2 more branches");
    expect(container.textContent).toContain("the Hosting tab");
  });

  it("uses the singular when exactly one branch is hidden", () => {
    render(
      <BranchPreviewsView
        error={null}
        limit={1}
        previews={response({
          branches: [
            preview({ branch: "main", targetId: "t1" }),
            preview({ branch: "feat/x", targetId: "t1" }),
          ],
        })}
        status="ready"
      />,
    );

    expect(container.textContent).toContain("1 more branch");
    expect(container.textContent).not.toContain("1 more branches");
  });
});
