import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { QaScope } from "../../../../../../src/features/checklists/model/qa-scope";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { ChecklistsTabPanel } from "../../../../../../src/features/projects/detail/views/checklists-tab-panel";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/checklists/project", () => ({
  ProjectChecklistsPanel: ({ myItems }: { myItems?: React.ReactNode }) => <div data-testid="panel">{myItems}</div>,
}));
jest.mock("../../../../../../src/features/checklists/returned", () => ({
  MyQaItemsCard: (props: { projectId: string; enabled: boolean; projectListElsewhere?: boolean }) => (
    <p
      data-testid="my-items"
      data-enabled={String(props.enabled)}
      data-elsewhere={String(Boolean(props.projectListElsewhere))}
    >
      {props.projectId}
    </p>
  ),
}));

const PROJECT = { id: "p1", workspaceId: "ws-1" } as ProvisionedProject;
const VM = { appRole: "member", qaChecklistsEnabled: true } as unknown as ProjectDetailTabsViewModel;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(qaScope: QaScope): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<ChecklistsTabPanel project={PROJECT} vm={VM} qaScope={qaScope} />);
  });
  return container;
}

/* The Overview shows only a summary of "My QA items"; its "Open checklist"
 * lands here, so a repository with no Project carries the full list here. */
describe("Checklists tab My QA items", () => {
  it("carries the full list for a repository with no Project", () => {
    const item = render({ kind: "repository" }).querySelector("[data-testid='my-items']");
    expect(item?.textContent).toBe("p1");
    expect(item?.getAttribute("data-enabled")).toBe("true");
    expect(item?.getAttribute("data-elsewhere")).toBe("false");
  });

  /* The card itself then draws nothing unless the server has no
   * Project-wide list (my-qa-items-card covers that fallback). */
  it("leaves it to the Project page for a repository in a Project", () => {
    const container = render({
      kind: "project",
      deliveryProjectId: "dp-1",
      projectName: "Checkout",
      projectHref: "/workflows?group=g&project=dp-1",
    });
    expect(container.querySelector("[data-testid='my-items']")?.getAttribute("data-elsewhere")).toBe("true");
    expect(container.querySelector("[data-testid='panel']")).not.toBeNull();
  });
});
