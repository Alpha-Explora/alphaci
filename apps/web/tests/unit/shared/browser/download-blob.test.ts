import { downloadBlob } from "../../../../src/shared/browser/download-blob";

describe("downloadBlob", () => {
  const createObjectURL = jest.fn(() => "blob:report-1");
  const revokeObjectURL = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("clicks a temporary anchor named for the file, then removes it and revokes the URL", () => {
    const clicked: HTMLAnchorElement[] = [];
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
      // Attached while clicked (Firefox ignores detached anchors).
      expect(document.body.contains(this)).toBe(true);
    });
    const blob = new Blob(["{}"], { type: "application/json" });

    downloadBlob("QA-Report-tone-orders-api-main-a1b2c3d.json", blob);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("QA-Report-tone-orders-api-main-a1b2c3d.json");
    expect(clicked[0].getAttribute("href")).toBe("blob:report-1");
    expect(document.querySelector("a")).toBeNull();
    // Revoked on the next task, not in the click's own tick.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report-1");
  });

  it("still cleans up when the click throws", () => {
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => downloadBlob("a.json", new Blob(["x"]))).toThrow("blocked");
    expect(document.querySelector("a")).toBeNull();
    jest.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report-1");
  });
});
