import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeploymentProvisioningSummary } from "../../src/components/product/setup-result-panel";
import type { DeploymentProvisioningResult } from "../../src/lib/api/contracts";

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react");
  const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const motion = new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
          const domProps = { ...props };
          for (const key of [
            "initial",
            "animate",
            "exit",
            "transition",
            "whileHover",
            "whileTap",
            "variants",
            "layout",
            "layoutId",
          ]) {
            delete domProps[key];
          }
          return React.createElement("div", domProps, children);
        },
    },
  );

  return {
    AnimatePresence: passthrough,
    motion,
  };
});

function render(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return { container, root };
}

describe("DeploymentProvisioningSummary", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
  });

  it("renders Render image deploy metadata without claiming deploy completion", () => {
    const result: DeploymentProvisioningResult = {
      status: "completed",
      targets: [
        {
          slot: "backend",
          provider: "render",
          ownershipMode: "flowci_managed",
          deploymentStrategy: "render_image_pushed",
          status: "created",
          deploymentTargetId: "target-1",
          providerProjectId: "srv-123",
          providerProjectName: "orders-api",
          providerMetadata: {
            githubSecrets: {
              apiKey: "RENDER_BACKEND_API_KEY",
              serviceId: "RENDER_BACKEND_SERVICE_ID",
              ownerId: "RENDER_BACKEND_OWNER_ID",
            },
          },
          renderServiceType: "web_service",
          renderInstanceType: "free",
          renderRegion: "singapore",
          renderEnvironmentName: "test",
          errorSummary: null,
          env: [],
        },
      ],
    };

    const rendered = render(<DeploymentProvisioningSummary result={result} />);
    root = rendered.root;

    expect(rendered.container.textContent).toContain("Archived managed image deploy");
    expect(rendered.container.textContent).toContain("web service - free - singapore - test");
    expect(rendered.container.textContent).toContain("Render API deployment secrets installed");
    expect(rendered.container.textContent).not.toContain("Deploy succeeded");
  });
});
