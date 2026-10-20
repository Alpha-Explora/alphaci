import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  captureElement,
  imageFromFile,
  supportsScreenCapture,
} from "../../../../../src/features/checklists/data/evidence-capture-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaAttachmentsRepository } from "../../../../../src/features/checklists/data/qa-attachments-repository";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { QA_ATTACHMENT_ERROR_MESSAGES } from "../../../../../src/features/checklists/model/qa-error-messages";
import { PreviewCaptureContext } from "../../../../../src/features/checklists/studio/view-models/preview-capture-target";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { attachment } from "../attachment-fixtures";
import { apiError } from "../checklist-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), setVerification: jest.fn(), signoff: jest.fn(), reopen: jest.fn() },
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
const mockedCapture = captureElement as jest.MockedFunction<typeof captureElement>;
const mockedImageFromFile = imageFromFile as jest.MockedFunction<typeof imageFromFile>;
const mockedSupports = supportsScreenCapture as jest.MockedFunction<typeof supportsScreenCapture>;

let root: Root | null = null;

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  mockedSupports.mockReturnValue(true);
  window.localStorage.clear();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 5; i += 1) {
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

function RunHarness({ role }: Readonly<{ role: AppRole }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId: "dp-1", enabled: true });
  return <ProjectRunPanel deliveryProjectId="dp-1" vm={vm} appRole={role} />;
}

/** QA Studio: the run column with the preview iframe on offer for Capture. */
function StudioHarness({
  frame,
  whileCapturing,
}: Readonly<{ frame: HTMLIFrameElement; whileCapturing?: <T>(capture: () => Promise<T>) => Promise<T> }>) {
  return (
    <PreviewCaptureContext.Provider value={{ current: frame, whileCapturing }}>
      <RunHarness role="qa" />
    </PreviewCaptureContext.Provider>
  );
}

function loadRun(overrides: Record<string, unknown> = {}, items?: Record<string, unknown>[]) {
  const wire = projectRunWire({
    attachments: { enabled: true, canAdd: true },
    items: items ?? [
      runItemWire({ attachmentCount: 2 }),
      runItemWire({ id: "run-item-2", position: 1, title: "Checkout works", requirementId: "req-sys", requirementName: "Release smoke test", requirementKind: "system", attachmentCount: 0 }),
    ],
    ...overrides,
  });
  runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: wire, heads: [] }));
}

const two = () => [
  attachment({ id: "att-1", caption: "Pay button missing" }),
  attachment({ id: "att-2", caption: null, createdAt: "2026-10-14T09:30:00.000Z", url: "https://storage.example.test/b.webp" }),
];

function sections(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("section.qa-evidence")];
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

async function key(target: Element, keyName: string, init: KeyboardEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true, cancelable: true, ...init }));
  });
}

function image(type: "image/webp" | "image/jpeg" = "image/webp") {
  return { blob: new Blob(["x"], { type }), type, width: 1280, height: 800 };
}

async function chooseFile(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('section.qa-evidence input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

async function typeCaption(container: HTMLElement, value: string) {
  const input = container.querySelector<HTMLInputElement>(".qa-evidence__draft input")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Evidence on a Project run item", () => {
  it("stays hidden, with no request, on a backend without screenshots", async () => {
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire(), heads: [] }));
    const container = await render(<RunHarness role="qa" />);
    expect(container.querySelector(".qa-run-item")).not.toBeNull();
    expect(sections(container)).toHaveLength(0);
    expect(attachments.listForRun).not.toHaveBeenCalled();
  });

  it("stays hidden when the server says storage is off", async () => {
    loadRun({ attachments: { enabled: false, canAdd: true } });
    const container = await render(<RunHarness role="qa" />);
    expect(sections(container)).toHaveLength(0);
    expect(attachments.listForRun).not.toHaveBeenCalled();
  });

  it("reads the run's screenshots once and shows thumbnails with a count, caption, uploader and alt text", async () => {
    loadRun();
    attachments.listForRun.mockResolvedValue(two());
    const container = await render(<RunHarness role="qa" />);
    expect(attachments.listForRun).toHaveBeenCalledTimes(1);
    expect(attachments.listForRun).toHaveBeenCalledWith("dp-1", "prun-1");
    const [first] = sections(container);
    expect(first.querySelector(".qa-evidence__count")?.textContent).toBe("2");
    expect(first.querySelector(".qa-evidence__count")?.getAttribute("aria-label")).toBe("2 screenshots");
    const images = [...first.querySelectorAll<HTMLImageElement>(".qa-evidence__thumb img")];
    expect(images.map((img) => img.alt)).toEqual([
      "Pay button missing",
      "Screenshot 2 of As a shopper, I can pay with a saved card",
    ]);
    expect(first.textContent).toContain("@ana-qa");
  });

  it("shows the run's count as placeholders while the list is read", async () => {
    loadRun();
    attachments.listForRun.mockReturnValue(new Promise(() => undefined));
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    expect(first.querySelector(".qa-evidence__count")?.textContent).toBe("2");
    expect(first.querySelectorAll(".qa-evidence__thumb-skeleton")).toHaveLength(2);
  });

  it("opens a lightbox dialog: focus on Close, arrows step, Tab stays inside, Escape closes and returns focus", async () => {
    loadRun();
    attachments.listForRun.mockResolvedValue(two());
    const container = await render(<RunHarness role="qa" />);
    const thumb = container.querySelector<HTMLButtonElement>(".qa-evidence__thumb")!;
    thumb.focus();
    await click(thumb);
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector("h2")?.textContent).toContain("As a shopper, I can pay with a saved card");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    expect(dialog.querySelector("img")?.alt).toBe("Pay button missing");
    expect(dialog.textContent).toContain("1 of 2");

    await key(dialog, "ArrowRight");
    expect(dialog.querySelector("img")?.alt).toBe("Screenshot 2 of As a shopper, I can pay with a saved card");
    expect(dialog.textContent).toContain("2 of 2");
    await key(dialog, "ArrowRight");
    expect(dialog.textContent).toContain("1 of 2");
    await key(dialog, "ArrowLeft");
    expect(dialog.textContent).toContain("2 of 2");

    // Tab from the last control wraps to the first; Shift+Tab from the first to the last.
    const controls = [...dialog.querySelectorAll<HTMLButtonElement>("button")];
    controls[controls.length - 1].focus();
    await key(dialog, "Tab");
    expect(document.activeElement).toBe(controls[0]);
    await key(dialog, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(controls[controls.length - 1]);

    await key(dialog, "Escape");
    await flush();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(thumb);
  });

  it("closes the lightbox from its Close button and with a click on the dim", async () => {
    loadRun();
    attachments.listForRun.mockResolvedValue(two());
    const container = await render(<RunHarness role="qa" />);
    await click(container.querySelector(".qa-evidence__thumb"));
    await click(button(document.body, "Close"));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await click(container.querySelector(".qa-evidence__thumb"));
    const dim = document.body.querySelector(".qa-lightbox")!;
    await act(async () => {
      dim.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("refreshes the list when an image's signed URL has run out", async () => {
    loadRun();
    attachments.listForRun.mockResolvedValue([attachment({ urlExpiresAt: "2000-01-01T00:00:00.000Z" })]);
    const container = await render(<RunHarness role="qa" />);
    expect(attachments.listForRun).toHaveBeenCalledTimes(1);
    await act(async () => {
      container.querySelector(".qa-evidence__thumb img")!.dispatchEvent(new Event("error"));
    });
    await flush();
    expect(attachments.listForRun).toHaveBeenCalledTimes(2);
  });

  it("hides every add control and delete when the server says this viewer cannot add", async () => {
    loadRun({ attachments: { enabled: true, canAdd: false } });
    attachments.listForRun.mockResolvedValue([attachment({ canDelete: false })]);
    const container = await render(<RunHarness role="member" />);
    // The item with screenshots shows them; the empty one shows nothing.
    expect(sections(container)).toHaveLength(1);
    const [first] = sections(container);
    expect(button(first, "Upload")).toBeUndefined();
    expect(button(first, "Capture")).toBeUndefined();
    expect(first.querySelector(".qa-evidence__icon-button")).toBeNull();
    expect(first.getAttribute("tabindex")).toBeNull();
  });

  it("shows a signed-off run's evidence read-only: no add, no delete", async () => {
    loadRun({ status: "signed_off", attachments: { enabled: true, canAdd: true } });
    attachments.listForRun.mockResolvedValue([attachment({ canDelete: true })]);
    const container = await render(<RunHarness role="qa" />);
    expect(sections(container)).toHaveLength(1);
    const [first] = sections(container);
    expect(first.textContent).toContain("Frozen at sign-off");
    expect(button(first, "Upload")).toBeUndefined();
    expect(first.querySelector(".qa-evidence__icon-button")).toBeNull();
    expect(first.querySelectorAll(".qa-evidence__thumb")).toHaveLength(1);
  });

  it("asks before deleting, inline: Keep cancels, Delete removes", async () => {
    loadRun();
    attachments.listForRun.mockResolvedValue(two());
    attachments.remove.mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, "confirm");
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    await click(button(first, "Delete screenshot: Pay button missing"));
    expect(first.textContent).toContain("Delete?");
    await click(button(first, "Keep"));
    expect(first.textContent).not.toContain("Delete?");
    expect(attachments.remove).not.toHaveBeenCalled();

    await click(button(first, "Delete screenshot: Pay button missing"));
    await click(button(first, "Delete"));
    expect(attachments.remove).toHaveBeenCalledWith("dp-1", "prun-1", "att-1");
    expect(first.querySelectorAll(".qa-evidence__thumb")).toHaveLength(1);
    expect(first.querySelector(".qa-evidence__count")?.textContent).toBe("1");
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("uploads a chosen file: compressed first, then an optional caption and Save", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedImageFromFile.mockResolvedValue(image());
    attachments.upload.mockResolvedValue(attachment({ id: "att-new", caption: "After pay" }));
    const container = await render(<RunHarness role="qa" />);
    expect(attachments.listForRun).not.toHaveBeenCalled();
    const [first] = sections(container);
    // Outside QA Studio there is no preview to capture: Upload and Paste only.
    expect(button(first, "Capture")).toBeUndefined();
    expect(button(first, "Upload")).toBeDefined();

    const file = new File(["png"], "shot.png", { type: "image/png" });
    await chooseFile(container, file);
    expect(mockedImageFromFile).toHaveBeenCalledWith(file);
    expect(first.querySelector<HTMLImageElement>(".qa-evidence__draft img")?.src).toBe("blob:preview");

    await typeCaption(container, "  After pay  ");
    await click(button(first, "Save screenshot"));
    expect(attachments.upload).toHaveBeenCalledWith(
      "dp-1",
      "prun-1",
      "run-item-1",
      expect.objectContaining({ caption: "After pay", source: "upload", fileName: expect.stringMatching(/^evidence-\d{8}-\d{6}\.webp$/) }),
    );
    expect(first.querySelector(".qa-evidence__draft")).toBeNull();
    expect(first.querySelectorAll(".qa-evidence__thumb")).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("discards a draft without saving", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedImageFromFile.mockResolvedValue(image());
    const container = await render(<RunHarness role="qa" />);
    await chooseFile(container, new File(["png"], "shot.png", { type: "image/png" }));
    await click(button(container, "Discard"));
    expect(container.querySelector(".qa-evidence__draft")).toBeNull();
    expect(attachments.upload).not.toHaveBeenCalled();
  });

  it("pastes an image from the clipboard into the focused Evidence area, and leaves text pastes alone", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedImageFromFile.mockResolvedValue(image());
    attachments.upload.mockResolvedValue(attachment({ id: "att-new" }));
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    expect(first.getAttribute("tabindex")).toBe("0");

    const textPaste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(textPaste, "clipboardData", { value: { files: [] } });
    await act(async () => {
      first.dispatchEvent(textPaste);
    });
    expect(textPaste.defaultPrevented).toBe(false);
    expect(mockedImageFromFile).not.toHaveBeenCalled();

    const file = new File(["png"], "image.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });
    await act(async () => {
      first.dispatchEvent(paste);
    });
    await flush();
    expect(paste.defaultPrevented).toBe(true);
    expect(mockedImageFromFile).toHaveBeenCalledWith(file);
    await click(button(first, "Save screenshot"));
    expect(attachments.upload).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1", expect.objectContaining({ source: "paste", caption: null }));
  });

  it("says a file is not an image the server takes", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedImageFromFile.mockRejectedValue(Object.assign(new Error("not an image"), { details: { code: "QA_ATTACHMENT_TYPE" } }));
    const container = await render(<RunHarness role="qa" />);
    await chooseFile(container, new File(["gif"], "a.gif", { type: "image/gif" }));
    expect(container.querySelector('.qa-evidence [role="alert"]')?.textContent).toContain(
      QA_ATTACHMENT_ERROR_MESSAGES.QA_ATTACHMENT_TYPE,
    );
  });

  it("maps a refused upload's code to its sentence and reads the list again when the item is full", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedImageFromFile.mockResolvedValue(image());
    attachments.listForRun.mockResolvedValue([]);
    attachments.upload.mockRejectedValue(
      Object.assign(apiError(409), { details: { code: "QA_ATTACHMENT_LIMIT", message: "limit reached" } }),
    );
    const container = await render(<RunHarness role="qa" />);
    await chooseFile(container, new File(["png"], "a.png", { type: "image/png" }));
    await click(button(container, "Save screenshot"));
    expect(container.textContent).toContain(QA_ATTACHMENT_ERROR_MESSAGES.QA_ATTACHMENT_LIMIT);
    expect(container.textContent).not.toContain("limit reached");
    expect(attachments.listForRun).toHaveBeenCalledTimes(1);
    // The draft stays, so the tester can try again.
    expect(container.querySelector(".qa-evidence__draft")).not.toBeNull();
  });

  it("stops offering more once the item holds five", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 5 })]);
    attachments.listForRun.mockResolvedValue([1, 2, 3, 4, 5].map((n) => attachment({ id: `att-${String(n)}` })));
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    expect(button(first, "Upload")).toBeUndefined();
    expect(first.textContent).toContain("This item holds 5 screenshots, the most it can.");
  });

  it("offers Capture in QA Studio, explains the prompt once, and crops to the preview iframe", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedCapture.mockResolvedValue(image());
    const frame = document.createElement("iframe");
    const container = await render(<StudioHarness frame={frame} />);
    const [first] = sections(container);
    expect(first.querySelector(".qa-evidence__hint")?.textContent).toContain("pick this one");
    await click(button(first, "Capture"));
    expect(mockedCapture).toHaveBeenCalledWith(frame);
    expect(first.querySelector(".qa-evidence__draft")).not.toBeNull();
    // The hint is remembered as seen.
    expect(first.querySelector(".qa-evidence__hint")).toBeNull();
  });

  it("captures with the studio's floating panel out of the way", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    const order: string[] = [];
    mockedCapture.mockImplementation(async () => {
      order.push("grab");
      return image();
    });
    const whileCapturing = jest.fn(async <T,>(capture: () => Promise<T>) => {
      order.push("hide");
      try {
        return await capture();
      } finally {
        order.push("show");
      }
    });
    const frame = document.createElement("iframe");
    const container = await render(<StudioHarness frame={frame} whileCapturing={whileCapturing} />);
    await click(button(sections(container)[0], "Capture"));
    expect(whileCapturing).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["hide", "grab", "show"]);
    expect(mockedCapture).toHaveBeenCalledWith(frame);
    expect(container.querySelector(".qa-evidence__draft")).not.toBeNull();
  });

  it("says nothing when the tester cancels the browser's share prompt", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    mockedCapture.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    const container = await render(<StudioHarness frame={document.createElement("iframe")} />);
    await click(button(container, "Capture"));
    expect(container.querySelector('.qa-evidence [role="alert"]')).toBeNull();
    expect(button(container, "Capture")?.disabled).toBe(false);
  });

  it("hides Capture where the browser cannot share a tab", async () => {
    mockedSupports.mockReturnValue(false);
    loadRun({}, [runItemWire({ attachmentCount: 0 })]);
    const container = await render(<StudioHarness frame={document.createElement("iframe")} />);
    expect(button(container, "Capture")).toBeUndefined();
    expect(button(container, "Upload")).toBeDefined();
  });

  it("offers to try again when the run's list could not be read", async () => {
    loadRun();
    attachments.listForRun.mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(two());
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    expect(first.textContent).toContain("The screenshots could not be loaded.");
    await click(button(first, "Try again"));
    expect(first.querySelectorAll(".qa-evidence__thumb")).toHaveLength(2);
  });
});

describe("Evidence with a Developer's proof of the fix", () => {
  const mixed = () => [
    attachment({ id: "att-1", caption: "Pay button missing" }),
    attachment({
      id: "fix-1",
      kind: "fix_proof",
      caption: "Pay button back",
      createdByLogin: "dev-dan",
      createdAt: "2026-10-14T11:00:00.000Z",
      url: "https://storage.example.test/fix.webp",
    }),
  ];

  function groups(section: HTMLElement) {
    return [...section.querySelectorAll<HTMLElement>('[role="group"].qa-evidence__group')];
  }

  it("draws exactly as before while the item holds no fix proof", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 2, fixProofCount: 0 })]);
    attachments.listForRun.mockResolvedValue(two());
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    expect(first.querySelector(".qa-evidence__groups")).toBeNull();
    expect(groups(first)).toHaveLength(0);
    expect(first.querySelectorAll(".qa-evidence__thumb")).toHaveLength(2);
    expect(button(first, "Upload")).toBeDefined();
  });

  it("shows QA evidence and Fix proof as two labelled groups, with the uploader and time on the fix", async () => {
    loadRun({}, [runItemWire({ status: "pending", attachmentCount: 2, fixProofCount: 1 })]);
    attachments.listForRun.mockResolvedValue(mixed());
    const container = await render(<RunHarness role="qa" />);
    const [first] = sections(container);
    expect(first.querySelector(".qa-evidence__head .qa-evidence__count")?.textContent).toBe("2");
    const [qa, fix] = groups(first);
    expect(qa.getAttribute("aria-label")).toBe("QA evidence");
    expect(fix.getAttribute("aria-label")).toBe("Fix proof");
    expect([...qa.querySelectorAll<HTMLImageElement>(".qa-evidence__thumb img")].map((img) => img.alt)).toEqual([
      "Pay button missing",
    ]);
    expect([...fix.querySelectorAll<HTMLImageElement>(".qa-evidence__thumb img")].map((img) => img.alt)).toEqual([
      "Pay button back",
    ]);
    expect(fix.querySelector(".qa-evidence__by")?.textContent).toContain("@dev-dan");
    // QA adds evidence only: the fix group has no add controls of its own.
    expect(button(qa, "Upload")).toBeDefined();
    expect(button(fix, "Upload")).toBeUndefined();
  });

  it("shows the groups from the run's count while the list is read", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 3, fixProofCount: 1 })]);
    attachments.listForRun.mockReturnValue(new Promise(() => undefined));
    const container = await render(<RunHarness role="qa" />);
    const [qa, fix] = groups(sections(container)[0]);
    expect(qa.querySelectorAll(".qa-evidence__thumb-skeleton")).toHaveLength(2);
    expect(fix.querySelectorAll(".qa-evidence__thumb-skeleton")).toHaveLength(1);
  });

  it("uploads QA's own screenshot as evidence, never as a fix proof", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 1, fixProofCount: 1 })]);
    attachments.listForRun.mockResolvedValue([mixed()[1]]);
    mockedImageFromFile.mockResolvedValue(image());
    attachments.upload.mockResolvedValue(attachment({ id: "att-new" }));
    const container = await render(<RunHarness role="qa" />);
    await chooseFile(container, new File(["png"], "shot.png", { type: "image/png" }));
    await click(button(container, "Save screenshot"));
    expect(attachments.upload).toHaveBeenCalledWith(
      "dp-1",
      "prun-1",
      "run-item-1",
      expect.objectContaining({ kind: "evidence" }),
    );
    const [qa] = groups(sections(container)[0]);
    expect(qa.querySelectorAll(".qa-evidence__thumb")).toHaveLength(1);
  });

  it("counts QA's limit apart from the fix proofs", async () => {
    const fixes = [1, 2, 3, 4, 5].map((n) => attachment({ id: `fix-${String(n)}`, kind: "fix_proof" }));
    loadRun({}, [runItemWire({ attachmentCount: 5, fixProofCount: 5 })]);
    attachments.listForRun.mockResolvedValue(fixes);
    const container = await render(<RunHarness role="qa" />);
    const [qa] = groups(sections(container)[0]);
    expect(button(qa, "Upload")).toBeDefined();
    expect(container.textContent).not.toContain("the most it can");
  });

  it("titles the lightbox with the kind of image it shows", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 2, fixProofCount: 1 })]);
    attachments.listForRun.mockResolvedValue(mixed());
    const container = await render(<RunHarness role="qa" />);
    const [qa, fix] = groups(sections(container)[0]);
    await click(fix.querySelector(".qa-evidence__thumb"));
    expect(document.body.querySelector('[role="dialog"] h2')?.textContent).toBe(
      "Fix proof · As a shopper, I can pay with a saved card",
    );
    await click(button(document.body, "Close"));
    await click(qa.querySelector(".qa-evidence__thumb"));
    expect(document.body.querySelector('[role="dialog"] h2')?.textContent).toBe(
      "QA evidence · As a shopper, I can pay with a saved card",
    );
  });

  it("lets a lead delete a Developer's fix proof where the server allows it", async () => {
    loadRun({}, [runItemWire({ attachmentCount: 2, fixProofCount: 1 })]);
    attachments.listForRun.mockResolvedValue(mixed());
    attachments.remove.mockResolvedValue(undefined);
    const container = await render(<RunHarness role="lead" />);
    const [, fix] = groups(sections(container)[0]);
    await click(button(fix, "Delete screenshot: Pay button back"));
    await click(button(fix, "Delete"));
    expect(attachments.remove).toHaveBeenCalledWith("dp-1", "prun-1", "fix-1");
    // With the last fix proof gone, the section returns to its single-group look.
    expect(sections(container)[0].querySelector(".qa-evidence__groups")).toBeNull();
  });
});
