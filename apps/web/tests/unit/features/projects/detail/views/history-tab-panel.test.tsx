import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../../src/features/checklists/data/iterations-repository";
import type { ProvisionedProject } from "../../../../../../src/features/projects";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { HistoryTabPanel } from "../../../../../../src/features/projects/detail/views/history-tab-panel";

jest.mock("../../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { list: jest.fn().mockResolvedValue([]) },
}));

const iterations = iterationsRepository as jest.Mocked<typeof iterationsRepository>;
const project = { id: "proj-fe" } as ProvisionedProject;
const vm = { qaChecklistsEnabled: true } as ProjectDetailTabsViewModel;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  jest.clearAllMocks();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

describe("HistoryTabPanel", () => {
  it("is the tabpanel the strip names, with the Project's history", async () => {
    const container = await render(
      <HistoryTabPanel
        project={project}
        vm={vm}
        qaScope={{ kind: "project", deliveryProjectId: "dp-1", projectName: "Logistics2", projectHref: null }}
      />,
    );
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.id).toBe("project-detail-panel-history");
    expect(panel?.getAttribute("aria-labelledby")).toBe("project-detail-tab-history");
    expect(iterations.list).toHaveBeenCalledWith("dp-1");
  });

  it("says a repository in no Project has no versions, and reads nothing", async () => {
    const container = await render(<HistoryTabPanel project={project} vm={vm} qaScope={{ kind: "repository" }} />);
    expect(container.textContent).toContain("No versions here");
    expect(container.textContent).toContain("Versions belong to a Project.");
    expect(iterations.list).not.toHaveBeenCalled();
  });
});
