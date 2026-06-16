import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { DeploymentProvisioningSetup } from "../../src/components/product/deployment-provisioning-setup";
import { useProviderConnections } from "../../src/hooks/use-provider-connections";
import type { DeploymentProvisioningRequest } from "../../src/lib/api/contracts";

jest.mock("../../src/hooks/use-provider-connections", () => ({
  useProviderConnections: jest.fn(),
}));

const mockedUseProviderConnections = useProviderConnections as jest.MockedFunction<typeof useProviderConnections>;

function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      "value",
    );
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("DeploymentProvisioningSetup", () => {
  beforeEach(() => {
    mockedUseProviderConnections.mockReturnValue({
      connections: [],
      loadConnections: jest.fn(),
      loading: false,
      revokeConnection: jest.fn(),
      saveConnection: jest.fn(),
      saving: false,
    });
  });

  it("builds a Render backend target with write-only env vars", () => {
    const onChange = jest.fn();
    const value: DeploymentProvisioningRequest = {
      enabled: true,
      targets: [
        {
          slot: "backend",
          provider: "render",
          ownershipMode: "flowci_managed",
          projectName: "orders-api-test",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm ci && npm run build",
          startCommand: "npm run start:prod",
          env: [{ environment: "test", vars: [{ key: "DATABASE_URL", value: "" }] }],
        },
      ],
    };

    const rendered = render(
      <DeploymentProvisioningSetup
        enabled
        repoShape="single-app"
        selectedProjectKind="backend"
        value={value}
        onChange={onChange}
      />,
    );

    expect(rendered.container.textContent).toContain("Deployment provisioning");
    expect(rendered.container.querySelector<HTMLInputElement>("input[aria-label='Provision deployment target']")).toBeChecked();
    expect(rendered.container.querySelector<HTMLSelectElement>("select[aria-label='Provider']")).toHaveValue("render");
    expect(rendered.container.querySelector<HTMLSelectElement>("select[aria-label='Render runtime']")).toHaveValue("docker");
    expect(rendered.container.textContent).toContain("Node.js / Bun");
    expect(rendered.container.textContent).toContain("Python");
    expect(rendered.container.textContent).toContain("Go");
    expect(rendered.container.querySelector<HTMLInputElement>("input[aria-label='Variable value 1']")).toHaveAttribute("type", "password");
    expect(rendered.container.textContent).toContain("Values are sent to the provider during setup and are not stored by FlowCI.");

    rendered.unmount();
  });

  it("updates the Render runtime choice", () => {
    const onChange = jest.fn();
    const value: DeploymentProvisioningRequest = {
      enabled: true,
      targets: [
        {
          slot: "backend",
          provider: "render",
          ownershipMode: "byo",
          renderDeployMethod: "native_git",
          renderRuntime: "node",
          projectName: "orders-api-test",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm ci && npm run build",
          startCommand: "npm run start:prod",
          env: [{ environment: "test", vars: [] }],
        },
      ],
    };

    const rendered = render(
      <DeploymentProvisioningSetup
        enabled
        repoShape="single-app"
        selectedProjectKind="backend"
        value={value}
        onChange={onChange}
      />,
    );

    changeValue(rendered.container.querySelector<HTMLSelectElement>("select[aria-label='Render runtime']")!, "python");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            renderRuntime: "python",
          }),
        ],
      }),
    );

    rendered.unmount();
  });

  it("updates shared variable groups separately from branch-specific variables", () => {
    const onChange = jest.fn();
    const value: DeploymentProvisioningRequest = {
      enabled: true,
      sharedEnv: [
        {
          environment: "test",
          vars: [{ key: "API_URL", value: "" }],
        },
      ],
      targets: [
        {
          slot: "backend",
          provider: "render",
          ownershipMode: "flowci_managed",
          projectName: "orders-api-test",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm ci && npm run build",
          env: [{ environment: "test", vars: [] }],
        },
      ],
    };

    const rendered = render(
      <DeploymentProvisioningSetup
        enabled
        repoShape="single-app"
        selectedProjectKind="backend"
        value={value}
        onChange={onChange}
      />,
    );

    expect(rendered.container.textContent).toContain("Shared branch group");
    expect(rendered.container.textContent).toContain("backend:test");
    expect(rendered.container.querySelector<HTMLInputElement>("input[aria-label='Shared variable key 1']")).toHaveValue("API_URL");

    changeValue(
      rendered.container.querySelector<HTMLInputElement>("input[aria-label='Shared variable value 1']")!,
      "https://api.example.com",
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sharedEnv: [
          {
            environment: "test",
            vars: [{ key: "API_URL", value: "https://api.example.com" }],
          },
        ],
        targets: [
          expect.objectContaining({
            env: [{ environment: "test", vars: [] }],
          }),
        ],
      }),
    );

    rendered.unmount();
  });

  it("keeps backend and frontend targets editable in multi-repo setup", () => {
    const onChange = jest.fn();
    const value: DeploymentProvisioningRequest = {
      enabled: true,
      targets: [
        {
          slot: "backend",
          provider: "render",
          ownershipMode: "flowci_managed",
          projectName: "demo-backend-test",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm ci && npm run build",
          startCommand: "npm run start:prod",
          env: [{ environment: "test", vars: [] }],
        },
        {
          slot: "frontend",
          provider: "vercel",
          ownershipMode: "flowci_managed",
          projectName: "demo-frontend-test",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm run build",
          env: [{ environment: "test", vars: [{ key: "NEXT_PUBLIC_API_URL", value: "" }] }],
        },
      ],
    };

    const rendered = render(
      <DeploymentProvisioningSetup
        enabled
        repoShape="multi"
        value={value}
        onChange={onChange}
      />,
    );

    expect(rendered.container.textContent).toContain("backend target");
    expect(rendered.container.textContent).toContain("frontend target");
    expect(rendered.container.textContent).toContain(
      "FlowCI creates the Vercel project and deploys it through GitHub Actions from the generated workflow.",
    );
    expect(rendered.container.textContent).toContain(
      "FlowCI will install per-slot GitHub Actions secrets for Vercel deployment after the Vercel project is created.",
    );

    const frontendProjectName = rendered.container.querySelector<HTMLInputElement>("input[aria-label='Provider project name 2']");
    expect(frontendProjectName).not.toBeNull();
    changeValue(frontendProjectName!, "custom-frontend-test");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({ projectName: "demo-backend-test" }),
          expect.objectContaining({ projectName: "custom-frontend-test" }),
        ],
      }),
    );

    rendered.unmount();
  });

  it("selects saved provider connections for BYO Vercel setup", () => {
    const onChange = jest.fn();
    mockedUseProviderConnections.mockReturnValue({
      connections: [
        {
          id: "connection-1",
          provider: "vercel",
          label: "Personal Vercel",
          tokenLastFour: "abcd",
          status: "active",
          metadata: {},
          createdAt: "2026-06-10T00:00:00.000Z",
          updatedAt: "2026-06-10T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
      loadConnections: jest.fn(),
      loading: false,
      revokeConnection: jest.fn(),
      saveConnection: jest.fn(),
      saving: false,
    });
    const value: DeploymentProvisioningRequest = {
      enabled: true,
      targets: [
        {
          slot: "frontend",
          provider: "vercel",
          ownershipMode: "byo",
          projectName: "orders-ui-test",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm run build",
          env: [{ environment: "test", vars: [] }],
        },
      ],
    };

    const rendered = render(
      <DeploymentProvisioningSetup
        enabled
        repoShape="single-app"
        selectedProjectKind="frontend"
        value={value}
        onChange={onChange}
      />,
    );

    expect(rendered.container.querySelector<HTMLSelectElement>("select[aria-label='Provider connection']")).toHaveValue("connection-1");
    expect(rendered.container.textContent).toContain("Personal Vercel - abcd");
    expect(rendered.container.querySelector("input[placeholder='Vercel connection UUID']")).toBeNull();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            providerConnectionId: "connection-1",
          }),
        ],
      }),
    );

    rendered.unmount();
  });
});
