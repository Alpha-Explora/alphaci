import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { DeploymentProvisioningSetup } from "../../src/components/product/deployment-provisioning-setup";
import type { DeploymentProvisioningRequest } from "../../src/lib/api/contracts";

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
    expect(rendered.container.querySelector<HTMLInputElement>("input[aria-label='Variable value 1']")).toHaveAttribute("type", "password");
    expect(rendered.container.textContent).toContain("Values are sent to the provider during setup and are not stored by FlowCI.");

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
});
