import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { ClientCompositionInfo } from "../../../../src/shared/api/contracts";
import { EnterpriseClientCompositionSettingsView } from "../../../../src/features/settings/client-composition";

const activeComposition: ClientCompositionInfo = {
  enabled: true,
  clientId: "northwind",
  displayName: "Northwind Industries",
  edition: "enterprise",
  disabledCapabilities: ["runtime.preview-deployments"],
};

function renderView(composition: ClientCompositionInfo | null): {
  container: HTMLDivElement;
  root: Root;
} {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <EnterpriseClientCompositionSettingsView composition={composition} />,
    );
  });
  return { container, root };
}

describe("Enterprise client composition settings surface", () => {
  it("renders the backend-owned selected policy details", () => {
    const { container, root } = renderView(activeComposition);

    expect(container.textContent).toContain("Northwind Industries");
    expect(container.textContent).toContain("northwind");
    expect(container.textContent).toContain("runtime.preview-deployments");
    expect(container.textContent).toContain("deny-only");

    act(() => root.unmount());
  });

  it("renders nothing when the capability projection is absent", () => {
    const { container, root } = renderView(null);

    expect(container).toBeEmptyDOMElement();

    act(() => root.unmount());
  });
});
