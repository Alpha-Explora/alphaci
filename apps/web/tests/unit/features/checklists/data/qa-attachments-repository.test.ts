import { evidenceFormData, qaAttachmentsRepository } from "../../../../../src/features/checklists/data/qa-attachments-repository";
import { request } from "../../../../../src/shared/api/request";
import { attachmentWire } from "../attachment-fixtures";

jest.mock("../../../../../src/shared/api/request", () => {
  const actual = jest.requireActual("../../../../../src/shared/api/request");
  return { ...actual, request: jest.fn() };
});

const mockedRequest = request as jest.MockedFunction<typeof request>;

afterEach(() => jest.clearAllMocks());

const image = () => new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: "image/webp" });

describe("qaAttachmentsRepository", () => {
  it("lists one item's screenshots under its run, encoded, normalised", async () => {
    mockedRequest.mockResolvedValue({ items: [attachmentWire(), { broken: true }] });
    const list = await qaAttachmentsRepository.listForItem("dp 1", "prun/1", "item 1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp%201/qa-runs/prun%2F1/items/item%201/attachments");
    expect(list.map((entry) => entry.id)).toEqual(["att-1"]);
  });

  it("lists the whole run's screenshots in one request", async () => {
    mockedRequest.mockResolvedValue({ items: [attachmentWire(), attachmentWire({ id: "att-2", runItemId: "run-item-2" })] });
    const list = await qaAttachmentsRepository.listForRun("dp-1", "prun-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/attachments");
    expect(list).toHaveLength(2);
    mockedRequest.mockResolvedValue(undefined);
    expect(await qaAttachmentsRepository.listForRun("dp-1", "prun-1")).toEqual([]);
  });

  it("uploads multipart evidence: file, caption, source and kind, with no Content-Type of its own", async () => {
    mockedRequest.mockResolvedValue(attachmentWire());
    const saved = await qaAttachmentsRepository.upload("dp-1", "prun-1", "run-item-1", {
      file: image(),
      fileName: "evidence-20261014-090000.webp",
      caption: "Pay button missing",
      source: "capture",
    });
    expect(saved.id).toBe("att-1");
    const [path, init] = mockedRequest.mock.calls[0];
    expect(path).toBe("/delivery-projects/dp-1/qa-runs/prun-1/items/run-item-1/attachments");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toBeUndefined();
    const form = init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const file = form.get("file") as File;
    expect(file.name).toBe("evidence-20261014-090000.webp");
    expect(file.type).toBe("image/webp");
    expect(form.get("caption")).toBe("Pay button missing");
    expect(form.get("source")).toBe("capture");
    expect(form.get("kind")).toBe("evidence");
  });

  it("sends no caption field when there is none", () => {
    const form = evidenceFormData({ file: image(), fileName: "a.webp", caption: null, source: "paste" });
    expect(form.has("caption")).toBe(false);
    expect(form.get("source")).toBe("paste");
    expect([...form.keys()]).toEqual(["file", "source", "kind"]);
  });

  it("refuses an upload reply that is not an attachment", async () => {
    mockedRequest.mockResolvedValue({});
    await expect(
      qaAttachmentsRepository.upload("dp-1", "prun-1", "run-item-1", {
        file: image(),
        fileName: "a.webp",
        caption: null,
        source: "upload",
      }),
    ).rejects.toThrow(/did not return the screenshot/);
  });

  it("deletes one screenshot by id under its run", async () => {
    mockedRequest.mockResolvedValue(undefined);
    await qaAttachmentsRepository.remove("dp-1", "prun-1", "att 1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/qa-runs/prun-1/attachments/att%201", {
      method: "DELETE",
    });
  });
});
