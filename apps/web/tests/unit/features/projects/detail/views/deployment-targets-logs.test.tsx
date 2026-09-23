import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeploymentTargetsList } from "../../../../../../src/features/projects/detail/views/deployment-targets-list";
import type { DeploymentTarget } from "../../../../../../src/shared/api/contracts";
import { FakeEventSource } from "../../deployment-logs/log-fixtures";

function target(overrides: Partial<DeploymentTarget> = {}): DeploymentTarget {
  return {
    id: "target-api",
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

/* The Hosting tab's log console, reached from a target row or from the
 * Overview card's "Open full logs". */
describe("Hosting target logs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    FakeEventSource.install();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(logFocus: Parameters<typeof DeploymentTargetsList>[0]["logFocus"]) {
    act(() => {
      root.render(
        <DeploymentTargetsList
          logFocus={logFocus}
          managementEnabled
          onDetached={jest.fn()}
          onTargetChanged={jest.fn()}
          projectId="proj-1"
          targets={[target()]}
        />,
      );
    });
  }

  it("opens straight onto the focused target's deploy logs", () => {
    const window = { startTime: "2026-09-24T09:59:00.000Z", endTime: null };
    render({ targetId: "target-api", window });

    const console = container.querySelector(".deploy-logs-console");
    expect(console?.getAttribute("aria-label")).toBe("Render logs for alphaci-api");
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Time range"]')?.value).toBe("deploy");
    expect(FakeEventSource.latest().params.get("startTime")).toBe(window.startTime);
    expect(container.textContent).not.toMatch(/log stream integration/i);
  });

  it("keeps the console closed until asked for", () => {
    render(null);
    expect(container.querySelector(".deploy-logs-console")).toBeNull();
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
