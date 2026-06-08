import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeploymentProvidersSection } from "../../src/components/settings/deployment-providers-section";
import { useCapabilities } from "../../src/hooks/use-capabilities";
import { useProviderConnections } from "../../src/hooks/use-provider-connections";

jest.mock("../../src/hooks/use-capabilities", () => ({
  useCapabilities: jest.fn(),
}));

jest.mock("../../src/hooks/use-provider-connections", () => ({
  useProviderConnections: jest.fn(),
}));

const mockedUseCapabilities = useCapabilities as jest.MockedFunction<typeof useCapabilities>;
const mockedUseProviderConnections = useProviderConnections as jest.MockedFunction<typeof useProviderConnections>;

function renderComponent() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<DeploymentProvidersSection />);
  });

  return {
    container,
    root,
    cleanup: () => {
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

describe("DeploymentProvidersSection", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("hides provider controls when env provisioning is disabled", () => {
    mockedUseCapabilities.mockReturnValue({
      capabilities: { envProvisioning: { enabled: false, providers: [], environments: [], modes: [] } },
      envProvisioningEnabled: false,
      loadCapabilities: jest.fn(),
      loading: false,
    });
    mockedUseProviderConnections.mockReturnValue({
      connections: [],
      loadConnections: jest.fn(),
      loading: false,
      revokeConnection: jest.fn(),
      saveConnection: jest.fn(),
      saving: false,
    });

    const rendered = renderComponent();
    root = rendered.root;

    expect(rendered.container.textContent).not.toContain("Deployment Providers");
  });

  it("clears token input and shows saved provider after submit", async () => {
    const saveConnection = jest.fn().mockResolvedValue({
      id: "connection-2",
      provider: "render",
      label: "Render main",
      tokenLastFour: "cret",
      status: "active",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      lastUsedAt: null,
    });
    mockedUseCapabilities.mockReturnValue({
      capabilities: {
        envProvisioning: {
          enabled: true,
          providers: ["render", "vercel"],
          environments: ["test", "uat", "production"],
          modes: ["byo", "flowci_managed"],
        },
      },
      envProvisioningEnabled: true,
      loadCapabilities: jest.fn(),
      loading: false,
    });
    mockedUseProviderConnections.mockReturnValue({
      connections: [
        {
          id: "connection-1",
          provider: "render",
          label: "Render main",
          tokenLastFour: "cret",
          status: "active",
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
      loadConnections: jest.fn(),
      loading: false,
      revokeConnection: jest.fn(),
      saveConnection,
      saving: false,
    });

    const rendered = renderComponent();
    root = rendered.root;
    const labelInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Label"]')!;
    const tokenInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Provider token"]')!;
    const form = rendered.container.querySelector("form")!;

    changeValue(labelInput, "Render main");
    changeValue(tokenInput, "rnd_secret");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(saveConnection).toHaveBeenCalledWith({
      provider: "render",
      label: "Render main",
      token: "rnd_secret",
    });
    expect(tokenInput.value).toBe("");
    expect(rendered.container.textContent).toContain("Render main");
    expect(rendered.container.textContent).toContain("render token ending cret");
  });

  it("revokes active provider connections", async () => {
    const revokeConnection = jest.fn().mockResolvedValue(undefined);
    mockedUseCapabilities.mockReturnValue({
      capabilities: {
        envProvisioning: {
          enabled: true,
          providers: ["render", "vercel"],
          environments: ["test", "uat", "production"],
          modes: ["byo", "flowci_managed"],
        },
      },
      envProvisioningEnabled: true,
      loadCapabilities: jest.fn(),
      loading: false,
    });
    mockedUseProviderConnections.mockReturnValue({
      connections: [
        {
          id: "connection-1",
          provider: "vercel",
          label: "Vercel team",
          tokenLastFour: "1234",
          status: "active",
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
      loadConnections: jest.fn(),
      loading: false,
      revokeConnection,
      saveConnection: jest.fn(),
      saving: false,
    });

    const rendered = renderComponent();
    root = rendered.root;
    const revokeButton = rendered.container.querySelector<HTMLButtonElement>("button.ghost-button")!;

    await act(async () => {
      revokeButton.click();
    });

    expect(revokeConnection).toHaveBeenCalledWith("connection-1");
  });
});
