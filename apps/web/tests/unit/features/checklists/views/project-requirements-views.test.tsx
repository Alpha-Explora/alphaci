import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { requirementsRepository } from "../../../../../src/features/checklists/data/requirements-repository";
import { normalizeProjectMyItems, normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import {
  normalizeProjectRequirements,
  normalizeRequirement,
  normalizeRequirementItem,
  REQUIREMENT_KINDS,
  SHOWN_REQUIREMENT_KINDS,
} from "../../../../../src/features/checklists/model/requirement-rules";
import { ProjectQaWorkspace } from "../../../../../src/features/checklists/requirements/views/project-qa-workspace";
import { ProjectRequirementsPanel } from "../../../../../src/features/checklists/requirements/views/project-requirements-panel";
import { ProjectMyItemsCard } from "../../../../../src/features/checklists/returned/views/project-my-items-card";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { headWire, itemWire, projectRequirementsWire, projectRunWire, requirementWire, runItemWire, SHA_BE, SHA_BE_NEW } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/requirements-repository", () => ({
  requirementsRepository: {
    listForProject: jest.fn(),
    create: jest.fn(),
    createBatch: jest.fn(),
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
  /* System requirements are hidden for now (SHOWN_REQUIREMENT_KINDS). */
  it("shows only the Features section by default, even when a System requirement exists", async () => {
    expect(SHOWN_REQUIREMENT_KINDS).toEqual(["functional"]);
    loadRequirements("lead");
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
    const sections = [...container.querySelectorAll("section.rq-section")];
    expect(sections.map((section) => section.getAttribute("data-kind"))).toEqual(["functional"]);
    expect(container.textContent).not.toContain("System requirements");
    expect(container.textContent).not.toContain("Release smoke test");
    expect(buttonNamed(container, "New system requirement")).toBeUndefined();
    expect(buttonNamed(container, "New Feature")).toBeDefined();
  });

  it("gives a Product owner the Features first, with create, edit, reorder and Progress", async () => {
    loadRequirements("lead");
    const container = await render(
      <ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" kinds={REQUIREMENT_KINDS} />,
    );
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

  it("calls them items in the New system requirement dialog (when System is shown)", async () => {
    loadRequirements("lead");
    const container = await render(
      <ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" kinds={REQUIREMENT_KINDS} />,
    );
    await act(async () => buttonNamed(container, "New system requirement")!.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Items (optional)");
    expect(dialog.querySelector('[aria-label="Item 1"]')).not.toBeNull();
    expect(buttonNamed(dialog, "Add item")).toBeDefined();
  });

  describe("New Feature: a side list of Features beside an editor", () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

    async function type(input: HTMLInputElement, value: string) {
      await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    async function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
      await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
      });
    }

    async function openNewFeature(kinds?: ReadonlyArray<"functional" | "system">, opener = "New Feature") {
      loadRequirements("lead");
      const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" kinds={kinds} />);
      await act(async () => buttonNamed(container, opener)!.click());
      // The dialog focuses its first field on a 0 ms timer; let it land.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return document.querySelector<HTMLElement>('[role="dialog"]')!;
    }

    const tabs = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const tabLabel = (tab: HTMLElement) => tab.querySelector(".rq-rail__name")?.textContent;
    const selectedTab = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
    const entryOf = (tab: HTMLElement) => tab.closest<HTMLElement>(".rq-rail__entry")!;
    const pane = (dialog: HTMLElement) => dialog.querySelector<HTMLElement>('[role="tabpanel"]')!;
    const nameField = (dialog: HTMLElement) =>
      pane(dialog).querySelector<HTMLInputElement>("input.hier-input:not(.rq-story-row__input)")!;
    const storyRows = (dialog: HTMLElement) => [...pane(dialog).querySelectorAll<HTMLInputElement>(".rq-story-row__input")];
    const position = (dialog: HTMLElement) => pane(dialog).querySelector(".rq-pane__position")?.textContent;
    const addButton = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>("button.rq-rail__add")!;
    const removeButton = (dialog: HTMLElement, label: string) =>
      dialog.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${label}"]`);
    const submit = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    /** Adds a Feature from the side list and names it (the new one opens with its Name focused). */
    async function addNamed(dialog: HTMLElement, name: string) {
      await act(async () => addButton(dialog).click());
      await type(nameField(dialog), name);
    }

    it("is one wide, labelled dialog: a vertical tablist of Features beside the open one's editor", async () => {
      const dialog = await openNewFeature();
      expect(dialog.classList.contains("hier-dialog--wide")).toBe(true);
      expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
      expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toMatch(/Add one or several/);
      // Title pinned above, actions pinned below; the list and the pane share the body.
      expect(dialog.querySelector(".hier-dialog-body .rq-batch .rq-rail")).not.toBeNull();
      expect(dialog.querySelector(".hier-dialog-footer button[type='submit']")?.textContent).toBe("Create feature");

      const tablist = dialog.querySelector<HTMLElement>('[role="tablist"]')!;
      expect(tablist.getAttribute("aria-orientation")).toBe("vertical");
      expect(tablist.getAttribute("aria-label")).toBe("Features");
      const [only] = tabs(dialog);
      expect(tabs(dialog)).toHaveLength(1);
      expect(only.getAttribute("aria-selected")).toBe("true");
      expect(only.tabIndex).toBe(0);
      expect(only.getAttribute("aria-controls")).toBe(pane(dialog).id);
      expect(pane(dialog).getAttribute("aria-labelledby")).toBe(only.id);
      // No name yet: a muted placeholder.
      expect(tabLabel(only)).toBe("Untitled feature");
      expect(only.querySelector(".rq-rail__name")?.getAttribute("data-untitled")).toBe("true");
      expect(position(dialog)).toBe("Feature 1 of 1");
      // The Name, not the tab before it, has focus; the only Feature has no remove.
      expect(document.activeElement).toBe(nameField(dialog));
      expect(dialog.querySelector(".rq-rail__close")).toBeNull();
      // The add button is a real button at the foot of the list, outside the tablist.
      expect(addButton(dialog).textContent).toContain("Add feature");
      expect(addButton(dialog).closest('[role="tablist"]')).toBeNull();
    });

    it("labels the tab with the Name as it is typed and counts its stories", async () => {
      const dialog = await openNewFeature();
      await type(nameField(dialog), "  Checkout   with saved cards ");
      const tab = selectedTab(dialog);
      expect(tabLabel(tab)).toBe("Checkout with saved cards");
      expect(tab.getAttribute("title")).toBe("Checkout with saved cards");
      expect(tab.querySelector(".rq-rail__name")?.getAttribute("data-untitled")).toBeNull();
      expect(tab.querySelector(".rq-rail__count")).toBeNull();
      expect(tab.textContent).toContain("No stories");

      await type(storyRows(dialog)[0], "As a shopper, I can save a card");
      await press(storyRows(dialog)[0], "Enter");
      await type(storyRows(dialog)[1], "As a shopper, I can pay with it");
      expect(tab.querySelector(".rq-rail__count")?.textContent).toBe("2");
      expect(tab.textContent).toContain("2 stories");

      await type(nameField(dialog), "   ");
      expect(tabLabel(tab)).toBe("Untitled feature");
    });

    it("adds from the list's button and on Ctrl+Enter (Cmd+Enter): the new Feature opens, Name focused", async () => {
      const dialog = await openNewFeature();
      await type(nameField(dialog), "Wallet");
      await act(async () => addButton(dialog).click());
      expect(tabs(dialog)).toHaveLength(2);
      expect(selectedTab(dialog)).toBe(tabs(dialog)[1]);
      expect(tabs(dialog).map((tab) => tab.tabIndex)).toEqual([-1, 0]);
      expect(position(dialog)).toBe("Feature 2 of 2");
      expect(nameField(dialog).value).toBe("");
      expect(document.activeElement).toBe(nameField(dialog));

      // Enter in a story still adds a row; Ctrl+Enter adds a Feature.
      await press(storyRows(dialog)[0], "Enter");
      expect(storyRows(dialog)).toHaveLength(2);
      await press(storyRows(dialog)[1], "Enter", { ctrlKey: true });
      expect(tabs(dialog)).toHaveLength(3);
      expect(selectedTab(dialog)).toBe(tabs(dialog)[2]);
      expect(storyRows(dialog)).toHaveLength(1);
      expect(document.activeElement).toBe(nameField(dialog));
      await press(nameField(dialog), "Enter", { metaKey: true });
      expect(tabs(dialog)).toHaveLength(4);
      expect(document.activeElement).toBe(nameField(dialog));
      // Blank Features are not counted.
      expect(submit(dialog).textContent).toBe("Create feature");
    });

    it("moves between Features with Arrow Up/Down, Home and End, with a roving tabindex", async () => {
      const dialog = await openNewFeature();
      await type(nameField(dialog), "Wallet");
      await addNamed(dialog, "Refunds");
      await addNamed(dialog, "Loyalty");
      expect(tabs(dialog).map(tabLabel)).toEqual(["Wallet", "Refunds", "Loyalty"]);

      await press(selectedTab(dialog), "ArrowUp");
      expect(tabLabel(selectedTab(dialog))).toBe("Refunds");
      expect(document.activeElement).toBe(selectedTab(dialog));
      expect(nameField(dialog).value).toBe("Refunds");
      expect(position(dialog)).toBe("Feature 2 of 3");
      expect(tabs(dialog).map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);

      await press(selectedTab(dialog), "ArrowDown");
      expect(tabLabel(selectedTab(dialog))).toBe("Loyalty");
      await press(selectedTab(dialog), "ArrowDown");
      expect(tabLabel(selectedTab(dialog))).toBe("Wallet");
      await press(selectedTab(dialog), "End");
      expect(tabLabel(selectedTab(dialog))).toBe("Loyalty");
      await press(selectedTab(dialog), "Home");
      expect(tabLabel(selectedTab(dialog))).toBe("Wallet");
      expect(document.activeElement).toBe(selectedTab(dialog));
      expect(pane(dialog).getAttribute("aria-labelledby")).toBe(selectedTab(dialog).id);

      // A click opens a Feature too.
      await act(async () => tabs(dialog)[1].click());
      expect(nameField(dialog).value).toBe("Refunds");
    });

    it("removes a Feature with its own close button and opens the neighbour", async () => {
      const dialog = await openNewFeature();
      await type(nameField(dialog), "Wallet");
      await addNamed(dialog, "Refunds");
      await addNamed(dialog, "Loyalty");
      expect(submit(dialog).textContent).toBe("Create 3 features");
      await act(async () => tabs(dialog)[1].click());

      // Every entry has one; only the open one's is in the Tab order.
      expect(removeButton(dialog, "Refunds")!.tabIndex).toBe(0);
      expect(removeButton(dialog, "Wallet")!.tabIndex).toBe(-1);
      expect(removeButton(dialog, "Refunds")!.closest('[role="tab"]')).toBeNull();

      // The open one goes: the next opens.
      await act(async () => removeButton(dialog, "Refunds")!.click());
      expect(tabs(dialog).map(tabLabel)).toEqual(["Wallet", "Loyalty"]);
      expect(tabLabel(selectedTab(dialog))).toBe("Loyalty");
      expect(document.activeElement).toBe(selectedTab(dialog));
      expect(position(dialog)).toBe("Feature 2 of 2");
      expect(submit(dialog).textContent).toBe("Create 2 features");

      // The last one goes: the previous opens.
      await act(async () => removeButton(dialog, "Loyalty")!.click());
      expect(tabs(dialog).map(tabLabel)).toEqual(["Wallet"]);
      expect(nameField(dialog).value).toBe("Wallet");
      // The only Feature cannot be removed.
      expect(dialog.querySelector(".rq-rail__close")).toBeNull();

      // An unnamed one is removed by its placeholder.
      await act(async () => addButton(dialog).click());
      await act(async () => removeButton(dialog, "Untitled feature")!.click());
      expect(tabs(dialog)).toHaveLength(1);
    });

    it("sends ONE batch request and adds every returned Feature to the list", async () => {
      requirements.createBatch.mockResolvedValue([
        normalizeRequirement(requirementWire({ id: "req-a", name: "Wallet", items: [], createdAt: "2026-10-03T00:00:00Z" }))!,
        normalizeRequirement(requirementWire({ id: "req-b", name: "Refunds", items: [], createdAt: "2026-10-04T00:00:00Z" }))!,
      ]);
      const dialog = await openNewFeature();
      await type(nameField(dialog), "Wallet");
      await addNamed(dialog, "Refunds");
      // An empty third Feature is ignored, not an error.
      await act(async () => addButton(dialog).click());
      expect(submit(dialog).textContent).toBe("Create 2 features");
      await act(async () => submit(dialog).click());
      await act(async () => {
        await Promise.resolve();
      });
      expect(requirements.createBatch).toHaveBeenCalledTimes(1);
      expect(requirements.createBatch).toHaveBeenCalledWith("dp-1", {
        kind: "functional",
        requirements: [{ name: "Wallet" }, { name: "Refunds" }],
      });
      expect(requirements.create).not.toHaveBeenCalled();
      const titles = [...document.querySelectorAll(".rq-card__title")].map((node) => node.textContent);
      expect(titles).toEqual(expect.arrayContaining(["Wallet", "Refunds"]));
    });

    it("opens the Feature the server's error names, marks its tab and focuses its Name", async () => {
      requirements.createBatch.mockRejectedValue(
        Object.assign(new Error("HTTP 409"), { status: 409, details: { code: "REQUIREMENT_NAME_TAKEN", index: 1 } }),
      );
      const dialog = await openNewFeature();
      await type(nameField(dialog), "Wallet");
      await addNamed(dialog, "Checkout with saved cards");
      // Look at the first one when Create is pressed.
      await act(async () => tabs(dialog)[0].click());
      await act(async () => submit(dialog).click());
      await act(async () => {
        await Promise.resolve();
      });
      const second = tabs(dialog)[1];
      expect(selectedTab(dialog)).toBe(second);
      expect(entryOf(second).getAttribute("data-invalid")).toBe("true");
      expect(second.querySelector(".rq-rail__marker")?.textContent).toBe("!");
      expect(second.textContent).toContain("needs a fix");
      expect(entryOf(tabs(dialog)[0]).getAttribute("data-invalid")).toBeNull();
      expect(pane(dialog).textContent).toContain("This Project already has a requirement with that name.");
      expect(nameField(dialog).getAttribute("aria-invalid")).toBe("true");
      expect(document.getElementById(nameField(dialog).getAttribute("aria-describedby")!)?.textContent).toMatch(/already has/);
      expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(
        'Nothing was created. Fix "Checkout with saved cards", then try again.',
      );
      expect(document.activeElement).toBe(nameField(dialog));
    });

    it("validates before sending: opens the first Feature at fault and focuses the field at fault", async () => {
      const dialog = await openNewFeature();
      // Feature 1 blank (ignored), Feature 2 a story but no name, Feature 3 a story too long.
      await act(async () => addButton(dialog).click());
      await type(storyRows(dialog)[0], "Pay later");
      await addNamed(dialog, "Gift cards");
      await type(storyRows(dialog)[0], "Fine");
      await press(storyRows(dialog)[0], "Enter");
      await type(storyRows(dialog)[1], "y".repeat(301));
      await act(async () => tabs(dialog)[0].click());

      await act(async () => submit(dialog).click());
      expect(requirements.createBatch).not.toHaveBeenCalled();
      expect(entryOf(tabs(dialog)[0]).getAttribute("data-invalid")).toBeNull();
      expect(entryOf(tabs(dialog)[1]).getAttribute("data-invalid")).toBe("true");
      expect(entryOf(tabs(dialog)[2]).getAttribute("data-invalid")).toBe("true");
      expect(selectedTab(dialog)).toBe(tabs(dialog)[1]);
      expect(pane(dialog).textContent).toContain("Give the Feature a name.");
      expect(document.activeElement).toBe(nameField(dialog));

      // Named now: its marker goes, and the next Create opens Feature 3 at its long story.
      await type(nameField(dialog), "Pay later");
      expect(entryOf(tabs(dialog)[1]).getAttribute("data-invalid")).toBeNull();
      await act(async () => submit(dialog).click());
      expect(selectedTab(dialog)).toBe(tabs(dialog)[2]);
      expect(pane(dialog).textContent).toContain("Keep each user story under 300 characters.");
      expect(document.activeElement).toBe(storyRows(dialog)[1]);
      expect(storyRows(dialog)[1].getAttribute("aria-invalid")).toBe("true");
      expect(nameField(dialog).getAttribute("aria-invalid")).toBeNull();
      expect(requirements.createBatch).not.toHaveBeenCalled();
    });

    it("words the System requirement dialog in its own terms (when System is shown)", async () => {
      const dialog = await openNewFeature(REQUIREMENT_KINDS, "New system requirement");
      expect(dialog.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe("System requirements");
      expect(tabLabel(selectedTab(dialog))).toBe("Untitled requirement");
      expect(addButton(dialog).textContent).toContain("Add requirement");
      await type(nameField(dialog), "Security");
      await act(async () => addButton(dialog).click());
      expect(removeButton(dialog, "Untitled requirement")).not.toBeNull();
      await type(nameField(dialog), "Performance");
      expect(position(dialog)).toBe("System requirement 2 of 2");
      expect(submit(dialog).textContent).toBe("Create 2 system requirements");
    });

    it("keeps the single form for an edit", async () => {
      loadRequirements("lead");
      const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
      const edit = container.querySelector<HTMLButtonElement>('button[aria-label^="Edit"]') ?? buttonNamed(container, "Edit");
      await act(async () => edit!.click());
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.classList.contains("hier-dialog--wide")).toBe(false);
      expect(dialog.querySelector('[role="tablist"]')).toBeNull();
      expect(dialog.querySelector(".rq-rail")).toBeNull();
      expect(dialog.querySelector('button[type="submit"]')?.textContent).toBe("Save");
    });
  });

  it("opens New Feature when the Project asks for it, once, and reports the Feature count", async () => {
    loadRequirements("lead");
    const onFeatureCount = jest.fn();
    const container = await render(
      <ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" newFeatureRequest={1} onFeatureCount={onFeatureCount} />,
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("New Feature");
    expect(onFeatureCount).toHaveBeenLastCalledWith(1);
    await act(async () => buttonNamed(document.body, "Cancel")!.click());
    await act(async () => {
      root!.render(
        <ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" newFeatureRequest={1} onFeatureCount={onFeatureCount} />,
      );
    });
    expect(container.querySelector(".rq-panel")).not.toBeNull();
    expect(document.querySelector(".rq-batch")).toBeNull();
  });

  it("never opens New Feature for a Developer, however it is asked", async () => {
    loadRequirements("member");
    await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="member" newFeatureRequest={1} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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

  it("brings the Requirements tab forward and opens New Feature on a new request, never on a revisit", async () => {
    loadRequirements("lead");
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire() }));
    runs.myItems.mockResolvedValue(normalizeProjectMyItems({}));
    const view = (request: number) => (
      <ProjectQaWorkspace deliveryProjectId="dp-1" projectName="storefront" appRole="lead" newFeatureRequest={request} />
    );
    const container = await render(view(0));
    const selected = () => container.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
    await act(async () => buttonNamed(container, "QA run")!.click());
    expect(selected()).toBe("QA run");

    await act(async () => root!.render(view(1)));
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(selected()).toBe("Requirements");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("New Feature");
    await act(async () => buttonNamed(document.body, "Cancel")!.click());

    // Leaving and coming back to the tab does not reopen it.
    await act(async () => buttonNamed(container, "QA run")!.click());
    await act(async () => buttonNamed(container, "Requirements")!.click());
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(document.querySelector(".rq-batch")).toBeNull();
  });

  it("renders nothing when disabled", async () => {
    const container = await render(<ProjectQaWorkspace deliveryProjectId="dp-1" projectName="storefront" appRole="lead" enabled={false} />);
    expect(container.textContent).toBe("");
    expect(requirements.listForProject).not.toHaveBeenCalled();
  });
});
