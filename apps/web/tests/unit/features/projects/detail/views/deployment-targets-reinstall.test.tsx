import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeploymentTargetsList } from "../../../../../../src/features/projects/detail/views/deployment-targets-list";
import {
  getDeploymentTargetActions,
  reinstallDeploymentSecrets,
} from "../../../../../../src/features/projects/detail/data/projects-api";
import type { AppRole, DeploymentTarget } from "../../../../../../src/shared/api/contracts";

jest.mock(
  "../../../../../../src/features/projects/detail/data/projects-api",
  () => ({
    ...jest.requireActual(
      "../../../../../../src/features/projects/detail/data/projects-api",
    ),
    getDeploymentTargetActions: jest.fn(),
    reinstallDeploymentSecrets: jest.fn(),
  }),
);

const mockGetActions = getDeploymentTargetActions as jest.MockedFunction<
  typeof getDeploymentTargetActions
>;
const mockReinstall = reinstallDeploymentSecrets as jest.MockedFunction<
  typeof reinstallDeploymentSecrets
>;

function target(overrides: Partial<DeploymentTarget> = {}): DeploymentTarget {
  return {
    id: "target-1",
    projectId: "proj-1",
    slot: "backend",
    ownershipMode: "flowci_managed",
    provider: "render",
    providerConnectionId: null,
    providerProjectId: "srv-1",
    providerProjectName: "alphaci-api",
    repoFullName: "tone/alphaci-api",
    branchName: "main",
    rootDirectory: ".",
    buildCommand: null,
    startCommand: null,
    environmentMap: {},
    status: "active",
    ...overrides,
  };
}

function actionsResponse(enabled: boolean) {
  return {
    targetId: "target-1",
    provider: "render" as const,
    actions: {
      sync: { enabled: true, mode: "local_metadata" as const },
      detach: { enabled: true },
      reinstallDeploymentSecrets: {
        enabled,
        ...(enabled ? {} : { reason: "Provider activation required" }),
      },
      openProviderDashboard: { enabled: true, url: null },
      openProviderConsole: { enabled: true, url: null },
    },
  };
}

/**
 * The reinstall button is gated on two independent things: the viewer's role
 * (Developer/admin, the hosting rule) AND the server's own
 * per-target descriptor. Neither alone is enough to show it.
 */
describe("Hosting target reinstall deployment secrets", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockGetActions.mockReset();
    mockReinstall.mockReset();
    mockGetActions.mockResolvedValue(actionsResponse(true));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(appRole?: AppRole, managementEnabled = true) {
    act(() => {
      root.render(
        <DeploymentTargetsList
          appRole={appRole}
          managementEnabled={managementEnabled}
          onDetached={jest.fn()}
          onTargetChanged={jest.fn()}
          projectId="proj-1"
          targets={[target()]}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function reinstallButton(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Reinstall deployment secrets",
    );
  }

  it("hides the button for a Product owner (lead), even though the descriptor is enabled", async () => {
    await render("lead");
    expect(mockGetActions).not.toHaveBeenCalled();
    expect(reinstallButton()).toBeUndefined();
  });

  it("hides the button for QA Team", async () => {
    await render("qa");
    expect(reinstallButton()).toBeUndefined();
  });

  it("hides the button for a Developer when the server disables it", async () => {
    mockGetActions.mockResolvedValue(actionsResponse(false));
    await render("member");
    expect(reinstallButton()).toBeUndefined();
    // Disabled means invisible, not a noisy reason shown inline.
    expect(container.textContent).not.toMatch(/Provider activation required/);
  });

  it("shows the button and helper copy for a Developer once the descriptor is enabled", async () => {
    await render("member");
    expect(reinstallButton()).toBeDefined();
    expect(container.textContent).toContain(
      "Rewrites this target's GitHub Actions secrets, including the Vercel test bypass secret.",
    );
  });

  it("hides the button for a Developer while target management is off", async () => {
    await render("member", false);
    expect(reinstallButton()).toBeUndefined();
  });

  it("shows the button for an admin once the descriptor is enabled", async () => {
    await render("admin");
    expect(reinstallButton()).toBeDefined();
  });

  it("reinstalls on click and reports the secret names the server wrote", async () => {
    mockReinstall.mockResolvedValue({
      reinstalled: true,
      githubSecrets: { renderDeployHook: "RENDER_DEPLOY_HOOK_URL" },
    });
    await render("member");

    await act(async () => {
      reinstallButton()!.click();
      await Promise.resolve();
    });

    expect(mockReinstall).toHaveBeenCalledWith("proj-1", "target-1");
    expect(container.textContent).toContain(
      "Deployment secrets reinstalled: RENDER_DEPLOY_HOOK_URL.",
    );
  });

  it("shows a Sign in again link on a 401", async () => {
    mockReinstall.mockRejectedValue(
      Object.assign(new Error("Request failed with status 401"), {
        status: 401,
        details: {
          message:
            "GitHub access token not found. Re-authenticate via GitHub OAuth.",
        },
      }),
    );
    await render("member");

    await act(async () => {
      reinstallButton()!.click();
      await Promise.resolve();
    });

    const signIn = Array.from(container.querySelectorAll("a")).find(
      (a) => a.textContent === "Sign in again",
    );
    expect(signIn?.getAttribute("href")).toBe("/login?next=/projects/proj-1");
  });

  it("shows the server's own message for a 400", async () => {
    mockReinstall.mockRejectedValue(
      Object.assign(new Error("Request failed with status 400"), {
        status: 400,
        details: {
          message:
            "vercel has no CI secrets to reinstall for a vercel_git_connected deployment.",
        },
      }),
    );
    await render("member");

    await act(async () => {
      reinstallButton()!.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(
      "vercel has no CI secrets to reinstall for a vercel_git_connected deployment.",
    );
  });

  describe("hosting mutation gate (HOSTING_LEAD_ONLY)", () => {
    function labels(): string[] {
      return Array.from(container.querySelectorAll("button")).map(
        (b) => b.textContent ?? "",
      );
    }

    it.each(["lead", "qa"] as const)(
      "hides Edit, Sync and Detach for %s but keeps logs and a note",
      async (role) => {
        await render(role);
        const all = labels();
        expect(all).not.toContain("Edit");
        expect(all.some((l) => /sync/i.test(l))).toBe(false);
        expect(all.some((l) => /detach/i.test(l))).toBe(false);
        expect(container.textContent).toContain("Developers and admins can");
      },
    );

    it.each(["member", "admin"] as const)(
      "shows Edit, Sync and Detach for %s",
      async (role) => {
        await render(role);
        const all = labels();
        expect(all).toContain("Edit");
        expect(all.some((l) => /sync/i.test(l))).toBe(true);
        expect(all.some((l) => /detach/i.test(l))).toBe(true);
        expect(container.textContent).not.toContain("Developers and admins can");
      },
    );
  });
});
