import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { imageFromFile } from "../../../../../src/features/checklists/data/evidence-capture-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaAttachmentsRepository } from "../../../../../src/features/checklists/data/qa-attachments-repository";
import { normalizeProjectMyItems } from "../../../../../src/features/checklists/model/project-run-rules";
import { QA_ATTACHMENT_ERROR_MESSAGES } from "../../../../../src/features/checklists/model/qa-error-messages";
import { ProjectMyItemsCard } from "../../../../../src/features/checklists/returned/views/project-my-items-card";
import { attachment } from "../attachment-fixtures";
import { apiError } from "../checklist-fixtures";
import { itemWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { myItems: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/requirements-repository", () => ({
  requirementsRepository: { setProgress: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/qa-attachments-repository", () => ({
  qaAttachmentsRepository: { listForRun: jest.fn(), listForItem: jest.fn(), upload: jest.fn(), remove: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/evidence-capture-repository", () => ({
  captureElement: jest.fn(),
  imageFromFile: jest.fn(),
  supportsScreenCapture: jest.fn(() => true),
}));

const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const attachments = qaAttachmentsRepository as jest.Mocked<typeof qaAttachmentsRepository>;
const mockedImageFromFile = imageFromFile as jest.MockedFunction<typeof imageFromFile>;

let root: Root | null = null;

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  await flush();
  return container;
}

function button(scope: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === name || entry.getAttribute("aria-label") === name,
  );
}

async function click(element: Element | undefined | null) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
  });
  await flush();
}

function image() {
  return { blob: new Blob(["x"], { type: "image/webp" }), type: "image/webp" as const, width: 1280, height: 800 };
}

async function chooseFile(scope: HTMLElement, file: File) {
  const input = scope.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

const TITLE = "As a shopper, I can pay with a saved card";

/** One My QA items entry with its run item; `runItem` overrides the run item's wire. */
function entry(runItem: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    requirement: { id: "req-1", name: "Checkout with saved cards", kind: "functional" },
    item: itemWire(item),
    runId: "prun-1",
    runItem: runItemWire(runItem),
  };
}

function loadFeed(buckets: Record<string, unknown>) {
  runs.myItems.mockResolvedValue(normalizeProjectMyItems(buckets));
}

function proof(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>("section.qa-fix-proof");
}

const returned = (runItem: Record<string, unknown> = {}) =>
  entry({ status: "returned_to_dev", verifiedBy: { id: "u", login: "ana-qa" }, ...runItem }, { progress: "in_progress" });

describe("A Developer's Proof of the fix in My QA items", () => {
  it("stays hidden, with no request, on a backend that sends no fix-proof fields", async () => {
    loadFeed({ returned: [returned()] });
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    expect(container.textContent).toContain("Returned by QA");
    expect(proof(container)).toBeNull();
    expect(attachments.listForItem).not.toHaveBeenCalled();
  });

  it("offers Paste and Upload (no Capture) on a returned item the server lets them prove, without a read when it has none", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 0 })] });
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    const section = proof(container)!;
    expect(section).not.toBeNull();
    expect(section.getAttribute("aria-label")).toBe(`Proof of the fix for ${TITLE}`);
    expect(section.textContent).toContain("Proof of the fix");
    expect(button(section, "Upload")).toBeDefined();
    expect(button(section, "Capture")).toBeUndefined();
    expect(section.textContent).toContain("paste");
    expect(section.getAttribute("tabindex")).toBe("0");
    expect(attachments.listForItem).not.toHaveBeenCalled();
    // It sits on the row, before the Progress control.
    const row = section.closest(".qa-returned__row")!;
    expect(row.querySelector("fieldset.rq-progress")).not.toBeNull();
  });

  it("uploads at once as fix_proof, with an optional caption, and shows the new thumbnail", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 0 })] });
    mockedImageFromFile.mockResolvedValue(image());
    attachments.upload.mockResolvedValue(
      attachment({ id: "fix-1", kind: "fix_proof", caption: "Card accepted", createdByLogin: "dev-dan" }),
    );
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    const section = proof(container)!;
    await chooseFile(section, new File(["png"], "fixed.png", { type: "image/png" }));
    const input = section.querySelector<HTMLInputElement>(".qa-evidence__draft input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "Card accepted");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button(section, "Save screenshot"));
    expect(attachments.upload).toHaveBeenCalledWith(
      "dp-1",
      "prun-1",
      "run-item-1",
      expect.objectContaining({ kind: "fix_proof", source: "upload", caption: "Card accepted" }),
    );
    const images = [...section.querySelectorAll<HTMLImageElement>(".qa-evidence__thumb img")];
    expect(images.map((img) => img.alt)).toEqual(["Card accepted"]);
    expect(section.textContent).toContain("@dev-dan");
    expect(section.querySelector(".qa-evidence__count")?.textContent).toBe("1");
  });

  it("pastes an image into the focused area", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 0 })] });
    mockedImageFromFile.mockResolvedValue(image());
    attachments.upload.mockResolvedValue(attachment({ id: "fix-1", kind: "fix_proof" }));
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    const section = proof(container)!;
    const file = new File(["png"], "image.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });
    await act(async () => {
      section.dispatchEvent(paste);
    });
    await flush();
    expect(paste.defaultPrevented).toBe(true);
    await click(button(section, "Save screenshot"));
    expect(attachments.upload).toHaveBeenCalledWith(
      "dp-1",
      "prun-1",
      "run-item-1",
      expect.objectContaining({ kind: "fix_proof", source: "paste" }),
    );
  });

  it("shows only the item's fix proofs, read-only once the server no longer allows adding, on a Ready for QA item", async () => {
    loadFeed({
      readyForQa: [entry({ status: "pending", attachmentCount: 3, fixProofCount: 2, canAttachFixProof: false }, { progress: "done" })],
    });
    attachments.listForItem.mockResolvedValue([
      attachment({ id: "qa-1", kind: "evidence", caption: "Card declined" }),
      attachment({ id: "fix-1", kind: "fix_proof", caption: "Now accepted", createdByLogin: "dev-dan", canDelete: false }),
      attachment({ id: "fix-2", kind: "fix_proof", caption: null, createdByLogin: "dev-dan", canDelete: false }),
    ]);
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    expect(attachments.listForItem).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1");
    const section = proof(container)!;
    const images = [...section.querySelectorAll<HTMLImageElement>(".qa-evidence__thumb img")];
    expect(images.map((img) => img.alt)).toEqual(["Now accepted", `Screenshot 2 of ${TITLE}`]);
    expect(section.textContent).not.toContain("Card declined");
    expect(button(section, "Upload")).toBeUndefined();
    expect(section.querySelector(".qa-evidence__icon-button")).toBeNull();
    expect(section.getAttribute("tabindex")).toBeNull();
  });

  it("deletes the Developer's own proof after an inline confirmation", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 1, attachmentCount: 1 })] });
    attachments.listForItem.mockResolvedValue([attachment({ id: "fix-1", kind: "fix_proof", caption: "Fixed", canDelete: true })]);
    attachments.remove.mockResolvedValue(undefined);
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    const section = proof(container)!;
    await click(button(section, "Delete screenshot: Fixed"));
    await click(button(section, "Delete"));
    expect(attachments.remove).toHaveBeenCalledWith("dp-1", "prun-1", "fix-1");
    expect(section.querySelectorAll(".qa-evidence__thumb")).toHaveLength(0);
  });

  it("opens the lightbox titled as a fix proof", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 1 })] });
    attachments.listForItem.mockResolvedValue([attachment({ id: "fix-1", kind: "fix_proof", caption: "Fixed" })]);
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    await click(proof(container)!.querySelector(".qa-evidence__thumb"));
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.querySelector("h2")?.textContent).toBe(`Fix proof · ${TITLE}`);
  });

  it("explains a refusal because QA moved the item, and reads the list again", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 0 })] });
    mockedImageFromFile.mockResolvedValue(image());
    attachments.listForItem.mockResolvedValue([]);
    attachments.upload.mockRejectedValue(
      Object.assign(apiError(409), { details: { code: "QA_FIX_PROOF_NOT_REQUESTED", message: "server words" } }),
    );
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    expect(runs.myItems).toHaveBeenCalledTimes(1);
    const section = proof(container)!;
    await chooseFile(section, new File(["png"], "a.png", { type: "image/png" }));
    await click(button(section, "Save screenshot"));
    expect(section.querySelector('[role="alert"]')?.textContent).toContain(
      QA_ATTACHMENT_ERROR_MESSAGES.QA_FIX_PROOF_NOT_REQUESTED,
    );
    expect(section.textContent).not.toContain("server words");
    expect(runs.myItems).toHaveBeenCalledTimes(2);
  });

  it("offers to try again when the item's screenshots could not be read", async () => {
    loadFeed({ returned: [returned({ canAttachFixProof: true, fixProofCount: 1 })] });
    attachments.listForItem
      .mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce([attachment({ id: "fix-1", kind: "fix_proof" })]);
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    const section = proof(container)!;
    expect(section.textContent).toContain("The screenshots of the fix could not be loaded.");
    await click(button(section, "Try again"));
    expect(section.querySelectorAll(".qa-evidence__thumb")).toHaveLength(1);
  });
});
