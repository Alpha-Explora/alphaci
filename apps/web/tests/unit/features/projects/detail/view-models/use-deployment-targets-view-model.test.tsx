import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  getDeploymentTargetActions,
  reinstallDeploymentSecrets,
} from "../../../../../../src/features/projects/detail/data/projects-api";
import type { AppRole, DeploymentTarget } from "../../../../../../src/shared/api/contracts";
import {
  useDeploymentTargetsViewModel,
  type DeploymentTargetsViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-deployment-targets-view-model";

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

function enabledActions() {
  return {
    targetId: "target-1",
    provider: "render" as const,
    actions: {
      sync: { enabled: true, mode: "local_metadata" as const },
      detach: { enabled: true },
      reinstallDeploymentSecrets: { enabled: true },
      openProviderDashboard: { enabled: true, url: null },
      openProviderConsole: { enabled: true, url: null },
    },
  };
}

let vm: DeploymentTargetsViewModel | null = null;

function Probe(
  props: Readonly<{
    appRole: AppRole | undefined;
    targets: DeploymentTarget[];
  }>,
) {
  const model = useDeploymentTargetsViewModel({
    projectId: "proj-1",
    targets: props.targets,
    appRole: props.appRole,
    onTargetChanged: jest.fn(),
    onDetached: jest.fn(),
  });
  useLayoutEffect(() => {
    vm = model;
  }, [model]);
  return null;
}

function current(): DeploymentTargetsViewModel {
  if (!vm) throw new Error("the ViewModel has not rendered");
  return vm;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * Reinstall is the one target action gated by both a server-computed
 * descriptor (`GET .../actions`) AND the viewer's role. These tests cover the
 * fetch gating (only a lead/admin ever asks) and the 401/403/400 mapping the
 * VM applies to a failed reinstall.
 */
describe("useDeploymentTargetsViewModel — reinstall deployment secrets", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vm = null;
    mockGetActions.mockReset();
    mockReinstall.mockReset();
    mockGetActions.mockResolvedValue(enabledActions());
    mockReinstall.mockResolvedValue({ reinstalled: true, githubSecrets: {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("never fetches target actions for a role that cannot reinstall", async () => {
    act(() => {
      root.render(<Probe appRole="member" targets={[target()]} />);
    });
    await flush();

    expect(mockGetActions).not.toHaveBeenCalled();
    expect(current().targetActions).toEqual({});
  });

  it("fetches target actions once per target for a lead, and does not refetch on rerender", async () => {
    act(() => {
      root.render(<Probe appRole="lead" targets={[target()]} />);
    });
    await flush();

    expect(mockGetActions).toHaveBeenCalledTimes(1);
    expect(mockGetActions).toHaveBeenCalledWith("proj-1", "target-1");
    expect(
      current().targetActions["target-1"]?.actions.reinstallDeploymentSecrets
        .enabled,
    ).toBe(true);

    act(() => {
      root.render(<Probe appRole="lead" targets={[target()]} />);
    });
    await flush();
    expect(mockGetActions).toHaveBeenCalledTimes(1);
  });

  it("goes pending, then reports the secret and variable names on success", async () => {
    mockReinstall.mockResolvedValue({
      reinstalled: true,
      githubSecrets: { renderDeployHook: "RENDER_DEPLOY_HOOK_URL" },
      githubVariables: { vercelTestBypass: "VERCEL_TEST_BYPASS_TOKEN" },
    });

    act(() => {
      root.render(<Probe appRole="admin" targets={[target()]} />);
    });
    await flush();

    let call: Promise<boolean> | null = null;
    act(() => {
      call = current().reinstallSecrets(target());
    });
    expect(current().reinstallingTargetId).toBe("target-1");

    let ok: boolean | undefined;
    await act(async () => {
      ok = await call!;
    });

    expect(ok).toBe(true);
    expect(mockReinstall).toHaveBeenCalledWith("proj-1", "target-1");
    expect(current().reinstallingTargetId).toBeNull();
    expect(current().message).toBe(
      "Deployment secrets reinstalled: RENDER_DEPLOY_HOOK_URL, VERCEL_TEST_BYPASS_TOKEN.",
    );
    expect(current().signInHref).toBeNull();
  });

  it("maps a 401 to a sign-in-again message with a login link", async () => {
    mockReinstall.mockRejectedValue(
      Object.assign(new Error("Request failed with status 401"), {
        status: 401,
        details: {
          message:
            "GitHub access token not found. Re-authenticate via GitHub OAuth.",
        },
      }),
    );

    act(() => {
      root.render(<Probe appRole="lead" targets={[target()]} />);
    });
    await flush();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await current().reinstallSecrets(target());
    });

    expect(ok).toBe(false);
    expect(current().signInHref).toBe("/login?next=/projects/proj-1");
    expect(current().message).toMatch(/sign in again/i);
  });

  it("maps a 403 to a role message with no sign-in link", async () => {
    mockReinstall.mockRejectedValue(
      Object.assign(new Error("Request failed with status 403"), {
        status: 403,
      }),
    );

    act(() => {
      root.render(<Probe appRole="lead" targets={[target()]} />);
    });
    await flush();

    await act(async () => {
      await current().reinstallSecrets(target());
    });

    expect(current().message).toBe(
      "Only team leads and admins can reinstall deployment secrets.",
    );
    expect(current().signInHref).toBeNull();
  });

  it("shows the server's own message verbatim for a 400", async () => {
    mockReinstall.mockRejectedValue(
      Object.assign(new Error("Request failed with status 400"), {
        status: 400,
        details: {
          message:
            "vercel has no CI secrets to reinstall for a vercel_git_connected deployment.",
        },
      }),
    );

    act(() => {
      root.render(<Probe appRole="lead" targets={[target()]} />);
    });
    await flush();

    await act(async () => {
      await current().reinstallSecrets(target());
    });

    expect(current().message).toBe(
      "vercel has no CI secrets to reinstall for a vercel_git_connected deployment.",
    );
    expect(current().signInHref).toBeNull();
  });
});
