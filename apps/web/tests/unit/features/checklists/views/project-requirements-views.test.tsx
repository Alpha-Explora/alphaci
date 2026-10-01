import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { requirementsRepository } from "../../../../../src/features/checklists/data/requirements-repository";
import { normalizeProjectMyItems, normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { normalizeProjectRequirements, normalizeRequirementItem } from "../../../../../src/features/checklists/model/requirement-rules";
import { ProjectQaWorkspace } from "../../../../../src/features/checklists/requirements/views/project-qa-workspace";
import { ProjectRequirementsPanel } from "../../../../../src/features/checklists/requirements/views/project-requirements-panel";
import { ProjectMyItemsCard } from "../../../../../src/features/checklists/returned/views/project-my-items-card";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { headWire, itemWire, projectRequirementsWire, projectRunWire, runItemWire, SHA_BE, SHA_BE_NEW } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/requirements-repository", () => ({
  requirementsRepository: {
    listForProject: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    reorderItems: jest.fn(),
    setProgress: jest.fn(),
  },
}));

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: {
    current: jest.fn(),
    start: jest.fn(),
    setVerification: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    myItems: jest.fn(),
  },
}));

const requirements = requirementsRepository as jest.Mocked<typeof requirementsRepository>;
const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) => button.textContent?.trim() === name);
}

function permissionsFor(role: AppRole) {
  return {
    canManage: role === "lead" || role === "admin",
    canSetProgress: role === "member" || role === "lead" || role === "admin",
  };
}

function loadRequirements(role: AppRole) {
  const wire = projectRequirementsWire({ permissions: permissionsFor(role) });
  if (role === "qa") {
    for (const requirement of wire.requirements) for (const item of requirement.items) item.canSetProgress = false;
  }
  requirements.listForProject.mockResolvedValue(normalizeProjectRequirements(wire));
}

describe("ProjectRequirementsPanel", () => {
  it("gives a Product owner the Features first, with create, edit, reorder and Progress", async () => {
    loadRequirements("lead");
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
    const sections = [...container.querySelectorAll("section.rq-section")];
    expect(sections.map((section) => section.getAttribute("data-kind"))).toEqual(["functional", "system"]);
    expect(sections[0].textContent).toContain("Functional Requirements (Features)");
    expect(sections[1].textContent).toContain("System requirements");
    expect(buttonNamed(container, "New Feature")).toBeDefined();
    expect(buttonNamed(container, "New system requirement")).toBeDefined();
    expect(buttonNamed(container, "Add user story")).toBeDefined();
    expect(container.querySelectorAll('button[aria-label^="Move "]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('input[type="radio"]').length).toBe(9);
    expect(container.textContent).toContain("You write the requirements.");
  });

  it("lets a Developer move Progress and nothing else", async () => {
    loadRequirements("member");
    const item = normalizeRequirementItem(itemWire(), "req-1")!;
    requirements.setProgress.mockResolvedValue({ item: { ...item, progress: "done", rowVersion: 2 }, readyForQaNotified: true });
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="member" />);
    expect(buttonNamed(container, "New Feature")).toBeUndefined();
    expect(buttonNamed(container, "Edit")).toBeUndefined();
    expect(buttonNamed(container, "Add user story")).toBeUndefined();
    expect(container.querySelector('button[aria-label^="Move "]')).toBeNull();
    expect(container.textContent).toContain("Mark it Done when it is ready for QA.");

    const done = container.querySelector<HTMLInputElement>('fieldset.rq-progress input[value="done"]')!;
    await act(async () => done.click());
    expect(requirements.setProgress).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }), {
      progress: "done",
      expectedRowVersion: 1,
    });
    expect(container.textContent).toContain("QA has been told this is ready.");
  });

  it("shows the QA Team the requirements read-only", async () => {
    loadRequirements("qa");
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="qa" />);
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(container.textContent).toContain("Progress: To do");
    expect(container.textContent).toContain("you verify them on the Project QA run");
    expect(buttonNamed(container, "New Feature")).toBeUndefined();
  });

  it("opens the New Feature dialog with a list of user stories, one input each", async () => {
    loadRequirements("lead");
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
    await act(async () => buttonNamed(container, "New Feature")!.click());
    // The dialog focuses its first field on a 0 ms timer; let that land first,
    // as it does before anyone types, or it can steal focus from the new row.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement?.getAttribute("placeholder")).toBe("Checkout with saved cards");
    expect(dialog.textContent).toContain("User stories (optional)");
    expect(dialog.textContent).not.toContain("one per line");
    expect(dialog.textContent).toContain("Create feature");
    expect(dialog.querySelector("textarea[placeholder^='As a shopper']")).toBeNull();

    const rows = () => Array.from(dialog.querySelectorAll<HTMLInputElement>(".rq-story-row input"));
    expect(rows().map((input) => input.getAttribute("aria-label"))).toEqual(["User story 1"]);

    // Type the first story, then Enter: a second row, and the dialog is not submitted.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(rows()[0], "Save a card");
      rows()[0].dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      rows()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(rows().map((input) => input.value)).toEqual(["Save a card", ""]);
    expect(document.activeElement).toBe(rows()[1]);
    expect(requirements.create).not.toHaveBeenCalled();

    // "Add user story" adds a row; the remove button takes it away again.
    await act(async () => buttonNamed(dialog, "Add user story")!.click());
    expect(rows()).toHaveLength(3);
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Remove user story 3"]')!.click());
    expect(rows()).toHaveLength(2);
  });

  it("calls them items in the New system requirement dialog", async () => {
    loadRequirements("lead");
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
    await act(async () => buttonNamed(container, "New system requirement")!.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Items (optional)");
    expect(dialog.querySelector('[aria-label="Item 1"]')).not.toBeNull();
    expect(buttonNamed(dialog, "Add item")).toBeDefined();
  });

  it("explains an empty Project by role", async () => {
    requirements.listForProject.mockResolvedValue(normalizeProjectRequirements({ requirements: [], permissions: permissionsFor("member") }));
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="member" />);
    expect(container.textContent).toContain("No Features yet. Your Product owner writes them.");
  });
});

function RunHarness({ role }: Readonly<{ role: AppRole }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId: "dp-1", enabled: true });
  return <ProjectRunPanel deliveryProjectId="dp-1" vm={vm} appRole={role} />;
}

describe("ProjectRunPanel", () => {
  it("offers Passed only on the item a Developer marked Done", async () => {
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire(), heads: [] }));
    const container = await render(<RunHarness role="qa" />);
    const selects = [...container.querySelectorAll<HTMLSelectElement>(".qa-status-select select")];
    expect(selects).toHaveLength(2);
    const options = (select: HTMLSelectElement) => [...select.options].filter((option) => !option.disabled).map((option) => option.value);
    expect(options(selects[0])).toContain("passed");
    expect(options(selects[1])).not.toContain("passed");
    expect(options(selects[1])).not.toContain("in_progress");
    expect(container.textContent).toContain("A Developer marks this Done before QA can pass it.");
    expect(container.textContent).toContain("Progress: Done");
    // Features first, then System requirements.
    const groups = [...container.querySelectorAll(".pqa-group__title")].map((title) => title.textContent);
    expect(groups).toEqual(["FeatureCheckout with saved cards", "System requirementRelease smoke test"]);
  });

  it("shows a Developer the run read-only", async () => {
    runs.current.mockResolvedValue(
      normalizeProjectRunCurrent({ run: projectRunWire({ permissions: { canSetVerification: false, canSignOff: false, canReopen: false, canDispatch: false } }) }),
    );
    const container = await render(<RunHarness role="member" />);
    expect(container.querySelector(".qa-status-select")).toBeNull();
    expect(buttonNamed(container, "Sign off")).toBeUndefined();
  });

  it("names the repository that moved, and offers QA a run on the current heads", async () => {
    runs.current.mockResolvedValue(
      normalizeProjectRunCurrent({
        run: projectRunWire({
          stale: true,
          repositories: [headWire(), headWire({ projectId: "proj-be", repoFullName: "tone/orders-api", runSha: SHA_BE, currentSha: SHA_BE_NEW, moved: true })],
        }),
      }),
    );
    const container = await render(<RunHarness role="qa" />);
    expect(container.textContent).toContain("This run is stale");
    expect(container.textContent).toContain("orders-api moved since this run (e4f5a6b → ffffeee)");
    expect(buttonNamed(container, "Start a run on the current heads")).toBeDefined();
  });

  it("says when requirements changed since sign-off", async () => {
    runs.current.mockResolvedValue(
      normalizeProjectRunCurrent({
        run: projectRunWire({
          status: "signed_off",
          requirementsChanged: true,
          items: [runItemWire({ status: "passed" })],
          signoff: { id: "s1", verdict: "APPROVED", summary: null, conditions: null, signedBy: { id: "u", login: "ana-qa" }, signedAt: "2026-10-01T10:00:00Z" },
        }),
      }),
    );
    const container = await render(<RunHarness role="lead" />);
    expect(container.textContent).toContain("Requirements changed since sign-off");
    expect(container.textContent).toContain("Signed off");
  });

  it("lets QA start the first run and tells a Developer who can", async () => {
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: null, heads: [headWire({ runSha: null })] }));
    runs.start.mockResolvedValue({ created: true, run: normalizeProjectRunCurrent({ run: projectRunWire() }).run! });
    const qa = await render(<RunHarness role="qa" />);
    expect(qa.textContent).toContain("storefront-web");
    await act(async () => buttonNamed(qa, "Start Project QA run")!.click());
    expect(runs.start).toHaveBeenCalledWith("dp-1");
    act(() => root?.unmount());
    root = null;

    const dev = await render(<RunHarness role="member" />);
    expect(buttonNamed(dev, "Start Project QA run")).toBeUndefined();
    expect(dev.textContent).toContain("QA Team members, Product owners and admins start the Project's QA run.");
  });
});

describe("ProjectMyItemsCard", () => {
  const feed = (overrides: Record<string, unknown> = {}) => ({
    requirement: { id: "req-1", name: "Checkout with saved cards", kind: "functional" },
    item: itemWire(),
    runId: null,
    runItem: null,
    ...overrides,
  });

  it("lists the four buckets, with QA's findings on returned items", async () => {
    runs.myItems.mockResolvedValue(
      normalizeProjectMyItems({
        returned: [feed({ runId: "prun-1", runItem: runItemWire({ status: "returned_to_dev", defectSeverity: "major", notes: "Card declined", verifiedBy: { id: "u", login: "ana-qa" } }) })],
        inProgress: [feed({ item: itemWire({ id: "i2", progress: "in_progress" }) })],
        todo: [feed({ item: itemWire({ id: "i3" }) })],
        readyForQa: [feed({ item: itemWire({ id: "i4", progress: "done" }) })],
      }),
    );
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    const titles = [...container.querySelectorAll(".qa-mine__section-title")].map((title) => title.textContent);
    expect(titles).toEqual(["Returned by QA1", "In progress1", "To do1", "Ready for QA1"]);
    expect(container.textContent).toContain("Card declined");
    expect(container.textContent).toContain("Returned by @ana-qa");
    expect(container.querySelectorAll("fieldset.rq-progress")).toHaveLength(4);
  });

  it("hides on the Overview when empty, and falls back on an older backend", async () => {
    runs.myItems.mockResolvedValue(normalizeProjectMyItems({}));
    const empty = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" hideWhenEmpty />);
    expect(empty.textContent).toBe("");
    act(() => root?.unmount());
    root = null;

    runs.myItems.mockRejectedValue(Object.assign(new Error("404"), { status: 404 }));
    const fallback = await render(
      <ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" fallback={<p>legacy card</p>} />,
    );
    expect(fallback.textContent).toBe("legacy card");
  });

  it("gives the QA Team the list without Progress controls", async () => {
    runs.myItems.mockResolvedValue(normalizeProjectMyItems({ readyForQa: [feed({ item: itemWire({ progress: "done" }) })] }));
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="qa" />);
    expect(container.querySelector("fieldset.rq-progress")).toBeNull();
    expect(container.textContent).toContain("Progress: Done");
  });
});

describe("ProjectQaWorkspace", () => {
  it("opens on the requirements for a Product owner and on the run for the QA Team, with arrow keys between tabs", async () => {
    loadRequirements("lead");
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire() }));
    runs.myItems.mockResolvedValue(normalizeProjectMyItems({}));
    const lead = await render(<ProjectQaWorkspace deliveryProjectId="dp-1" projectName="storefront" appRole="lead" />);
    const selected = () => lead.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
    expect(selected()).toBe("Requirements");
    expect(lead.querySelector("section.rq-section")).not.toBeNull();
    const tab = lead.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
    await act(async () => tab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(selected()).toBe("QA run");
    await act(async () => buttonNamed(lead, "My QA items")!.click());
    expect(selected()).toBe("My QA items");
    act(() => root?.unmount());
    root = null;

    const qa = await render(<ProjectQaWorkspace deliveryProjectId="dp-1" projectName="storefront" appRole="qa" />);
    expect(qa.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("QA run");
    expect(qa.textContent).toContain("then sign the Project off");
  });

  it("renders nothing when disabled", async () => {
    const container = await render(<ProjectQaWorkspace deliveryProjectId="dp-1" projectName="storefront" appRole="lead" enabled={false} />);
    expect(container.textContent).toBe("");
    expect(requirements.listForProject).not.toHaveBeenCalled();
  });
});
