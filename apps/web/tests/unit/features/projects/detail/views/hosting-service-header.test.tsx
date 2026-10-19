import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { HostingServiceHeader } from "../../../../../../src/features/projects/detail/views/hosting-service-header";
import { useDeploymentTargetsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-deployment-targets-view-model";
import {
  getDeploymentTargetActions,
  reinstallDeploymentSecrets,
} from "../../../../../../src/features/projects/detail/data/projects-api";
import type { DeploymentLogFocus } from "../../../../../../src/features/projects/deployment-logs";
import type { AppRole, DeploymentTarget } from "../../../../../../src/shared/api/contracts";
import { FakeEventSource } from "../../deployment-logs/log-fixtures";

jest.mock("../../../../../../src/features/projects/detail/data/projects-api", () => ({
  ...jest.requireActual("../../../../../../src/features/projects/detail/data/projects-api"),
  getDeploymentTargetActions: jest.fn(),
  reinstallDeploymentSecrets: jest.fn(),
}));

const mockGetActions = getDeploymentTargetActions as jest.MockedFunction<typeof getDeploymentTargetActions>;
const mockReinstall = reinstallDeploymentSecrets as jest.MockedFunction<typeof reinstallDeploymentSecrets>;

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
    rootDirectory: "apps/api",
    buildCommand: "npm run build",
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
      reinstallDeploymentSecrets: { enabled, ...(enabled ? {} : { reason: "Provider activation required" }) },
      openProviderDashboard: { enabled: true, url: null },
      openProviderConsole: { enabled: true, url: null },
    },
  };
}

function Harness({
  appRole,
  managementEnabled,
  logFocus,
  notice,
  onRetry,
}: Readonly<{
  appRole?: AppRole;
  managementEnabled: boolean;
  logFocus: DeploymentLogFocus | null;
  notice: string | null;
  onRetry: () => void;
}>) {
  const targets = [target()];
  const vm = useDeploymentTargetsViewModel({
    projectId: "proj-1",
    targets,
    appRole,
    onDetached: jest.fn(),
    onTargetChanged: jest.fn(),
  });
  return (
    <HostingServiceHeader
      target={targets[0]}
      projectId="proj-1"
      appRole={appRole}
      managementEnabled={managementEnabled}
      vm={vm}
      logFocus={logFocus}
      notice={notice}
      onRetry={onRetry}
    />
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  FakeEventSource.install();
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

async function render(
  appRole?: AppRole,
  options: { managementEnabled?: boolean; logFocus?: DeploymentLogFocus | null; notice?: string | null; onRetry?: () => void } = {},
) {
  act(() => {
    root.render(
      <Harness
        appRole={appRole}
        managementEnabled={options.managementEnabled ?? true}
        logFocus={options.logFocus ?? null}
        notice={options.notice ?? null}
        onRetry={options.onRetry ?? jest.fn()}
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}

function button(label: string): HTMLButtonElement | undefined {
  return buttons().find((item) => item.textContent === label);
}

function openMenu() {
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
  act(() => trigger?.click());
}

function menuItem(label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) =>
    item.querySelector(".hosting-menu__label")?.textContent === label,
  );
}

describe("Hosting service header", () => {
  it("names the service, its status and its build settings in one line", async () => {
    await render("member");
    expect(container.querySelector("h3")?.textContent).toBe("alphaci-api");
    expect(container.textContent).toContain("Active");
    expect(container.querySelector(".hosting-service__meta")?.textContent).toBe(
      "Render · Backend · deploys from Git · npm run build in apps/api",
    );
  });

  it("keeps Logs and Sync on the header and the rest in the ⋯ menu", async () => {
    await render("member");
    expect(button("Logs")).toBeDefined();
    expect(button("Sync")).toBeDefined();
    expect(button("Edit")).toBeUndefined();
    openMenu();
    expect(menuItem("Edit build settings")).toBeDefined();
    expect(menuItem("Reinstall deployment secrets")).toBeDefined();
    expect(menuItem("Detach")).toBeDefined();
    // No way into the provider's dashboard: it is ALPHACI's own account.
    expect(menuItem("Open in Render")).toBeUndefined();
    expect(container.querySelector('a[href*="render.com"], a[href*="vercel.com"]')).toBeNull();
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
  });

  it("shows the one provider notice in amber, with Retry", async () => {
    const onRetry = jest.fn();
    await render("member", { notice: "Render didn't answer, so deploy history may be incomplete.", onRetry });
    const notices = container.querySelectorAll(".hosting-notice");
    expect(notices).toHaveLength(1);
    expect(notices[0].getAttribute("role")).toBe("status");
    act(() => button("Retry")?.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("opens the edit form inline from the menu", async () => {
    await render("member");
    openMenu();
    act(() => menuItem("Edit build settings")?.click());
    expect(container.querySelector('[data-testid="target-edit-drawer"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Target build command"]')?.value).toBe("npm run build");
  });

  it("asks for confirmation inline before detaching, and can be cancelled", async () => {
    await render("member");
    openMenu();
    act(() => menuItem("Detach")?.click());
    expect(container.textContent).toContain("Confirm detach to remove this target from ALPHACI only.");
    expect(button("Confirm detach")).toBeDefined();
    act(() => button("Cancel")?.click());
    expect(button("Confirm detach")).toBeUndefined();
  });
});

/* Reached from the header's Logs, or from the Overview card's "Full logs". */
describe("Hosting service logs", () => {
  it("opens straight onto the focused target's deploy logs", async () => {
    const window = { startTime: "2026-09-24T09:59:00.000Z", endTime: null };
    await render("member", { logFocus: { targetId: "target-1", window } });
    const console = container.querySelector(".deploy-logs-console");
    expect(console?.getAttribute("aria-label")).toBe("Render logs for alphaci-api");
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Time range"]')?.value).toBe("deploy");
    expect(FakeEventSource.latest().params.get("startTime")).toBe(window.startTime);
  });

  it("keeps the console closed until asked for", async () => {
    await render("member");
    expect(container.querySelector(".deploy-logs-console")).toBeNull();
    act(() => button("Logs")?.click());
    expect(container.querySelector(".deploy-logs-console")).not.toBeNull();
    expect(button("Hide Logs")?.getAttribute("aria-expanded")).toBe("true");
  });
});

/**
 * Reinstall is gated on two independent things: the viewer's role
 * (Developer/admin, the hosting rule) AND the server's own per-target
 * descriptor. Neither alone is enough to offer it.
 */
describe("Hosting service reinstall deployment secrets", () => {
  it("is not offered to a Product owner, even though the descriptor is enabled", async () => {
    await render("lead");
    expect(mockGetActions).not.toHaveBeenCalled();
    openMenu();
    expect(menuItem("Reinstall deployment secrets")).toBeUndefined();
  });

  it("is not offered when the server disables it, and says nothing about why", async () => {
    mockGetActions.mockResolvedValue(actionsResponse(false));
    await render("member");
    openMenu();
    expect(menuItem("Reinstall deployment secrets")).toBeUndefined();
    expect(container.textContent).not.toMatch(/Provider activation required/);
  });

  it("is not offered while target management is off", async () => {
    await render("member", { managementEnabled: false });
    openMenu();
    expect(menuItem("Reinstall deployment secrets")).toBeUndefined();
  });

  it("explains itself and reports the secret names the server wrote", async () => {
    mockReinstall.mockResolvedValue({ reinstalled: true, githubSecrets: { renderDeployHook: "RENDER_DEPLOY_HOOK_URL" } });
    await render("admin");
    openMenu();
    const item = menuItem("Reinstall deployment secrets");
    expect(item?.textContent).toContain(
      "Rewrites this target's GitHub Actions secrets, including the Vercel test bypass secret.",
    );
    await act(async () => {
      item?.click();
      await Promise.resolve();
    });
    expect(mockReinstall).toHaveBeenCalledWith("proj-1", "target-1");
    expect(container.textContent).toContain("Deployment secrets reinstalled: RENDER_DEPLOY_HOOK_URL.");
  });

  it("shows a Sign in again link on a 401", async () => {
    mockReinstall.mockRejectedValue(
      Object.assign(new Error("Request failed with status 401"), {
        status: 401,
        details: { message: "GitHub access token not found. Re-authenticate via GitHub OAuth." },
      }),
    );
    await render("member");
    openMenu();
    await act(async () => {
      menuItem("Reinstall deployment secrets")?.click();
      await Promise.resolve();
    });
    const signIn = Array.from(container.querySelectorAll("a")).find((a) => a.textContent === "Sign in again");
    expect(signIn?.getAttribute("href")).toBe("/login?next=/projects/proj-1");
  });
});

describe("hosting mutation gate (HOSTING_LEAD_ONLY)", () => {
  it.each(["lead", "qa", undefined] as const)("hides Sync, Edit and Detach for %s but keeps Logs and a note", async (role) => {
    await render(role);
    expect(button("Logs")).toBeDefined();
    expect(buttons().some((item) => /sync/i.test(item.textContent ?? ""))).toBe(false);
    openMenu();
    expect(menuItem("Edit build settings")).toBeUndefined();
    expect(menuItem("Detach")).toBeUndefined();
    expect(menuItem("Open in Render")).toBeUndefined();
    expect(container.textContent).toContain("Developers and admins can");
  });

  it.each(["member", "admin"] as const)("offers Sync, Edit and Detach to %s", async (role) => {
    await render(role);
    expect(button("Sync")).toBeDefined();
    openMenu();
    expect(menuItem("Edit build settings")).toBeDefined();
    expect(menuItem("Detach")).toBeDefined();
    expect(container.textContent).not.toContain("Developers and admins can");
  });
});
