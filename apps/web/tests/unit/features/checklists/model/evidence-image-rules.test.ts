import {
  cropRect,
  evidenceFileName,
  exceedsPixelLimit,
  firstImageIndex,
  fitWithin,
  frameMatchesViewport,
  isQaImageType,
  MAX_IMAGE_BYTES,
  meetsTarget,
  pickEncoding,
  sniffImageType,
  TARGET_IMAGE_BYTES,
} from "../../../../../src/features/checklists/model/evidence-image-rules";

describe("fitWithin", () => {
  it("keeps an image that already fits, rounded to whole pixels", () => {
    expect(fitWithin({ width: 1280.4, height: 720.6 })).toEqual({ width: 1280, height: 721 });
  });

  it("scales the longest side down to 2560, keeping the aspect ratio", () => {
    expect(fitWithin({ width: 5120, height: 2880 })).toEqual({ width: 2560, height: 1440 });
    expect(fitWithin({ width: 1000, height: 4000 })).toEqual({ width: 640, height: 2560 });
  });

  it("takes another limit, and never collapses a side to zero", () => {
    expect(fitWithin({ width: 3840, height: 2160 }, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(fitWithin({ width: 10000, height: 1 }, 100)).toEqual({ width: 100, height: 1 });
    expect(fitWithin({ width: 0, height: 0 })).toEqual({ width: 1, height: 1 });
  });

  it("knows the server's 8000px limit", () => {
    expect(exceedsPixelLimit({ width: 8000, height: 8000 })).toBe(false);
    expect(exceedsPixelLimit({ width: 8001, height: 10 })).toBe(true);
    expect(exceedsPixelLimit({ width: 10, height: 9000 })).toBe(true);
  });
});

describe("cropRect", () => {
  const viewport = { width: 1440, height: 900 };

  it("maps the element's CSS box onto a frame at the same size", () => {
    expect(cropRect({ left: 100, top: 50, width: 800, height: 600 }, viewport, viewport)).toEqual({
      x: 100,
      y: 50,
      width: 800,
      height: 600,
    });
  });

  it("scales by frame/viewport on each axis (a 2x display)", () => {
    expect(cropRect({ left: 100, top: 50, width: 800, height: 600 }, viewport, { width: 2880, height: 1800 })).toEqual({
      x: 200,
      y: 100,
      width: 1600,
      height: 1200,
    });
  });

  it("rounds outward so a fractional box never loses its edge pixels", () => {
    expect(cropRect({ left: 10.4, top: 10.6, width: 100.2, height: 50.1 }, viewport, viewport)).toEqual({
      x: 10,
      y: 10,
      width: 101,
      height: 51,
    });
  });

  it("clamps a box that runs off the screen to the frame", () => {
    expect(cropRect({ left: -50, top: 800, width: 300, height: 400 }, viewport, viewport)).toEqual({
      x: 0,
      y: 800,
      width: 250,
      height: 100,
    });
  });

  it("is null when nothing of the element is visible, or a size is unknown", () => {
    expect(cropRect({ left: 2000, top: 0, width: 300, height: 300 }, viewport, viewport)).toBeNull();
    expect(cropRect({ left: 0, top: 0, width: 0, height: 300 }, viewport, viewport)).toBeNull();
    expect(cropRect({ left: 0, top: 0, width: 10, height: 10 }, { width: 0, height: 900 }, viewport)).toBeNull();
    expect(cropRect({ left: 0, top: 0, width: 10, height: 10 }, viewport, { width: 0, height: 0 })).toBeNull();
  });
});

describe("frameMatchesViewport", () => {
  it("accepts this tab's shape at any resolution", () => {
    expect(frameMatchesViewport({ width: 2880, height: 1800 }, { width: 1440, height: 900 })).toBe(true);
    expect(frameMatchesViewport({ width: 1438, height: 900 }, { width: 1440, height: 900 })).toBe(true);
  });

  it("refuses a screen or window of another shape, so the crop is not misplaced", () => {
    expect(frameMatchesViewport({ width: 1920, height: 1080 }, { width: 1440, height: 900 })).toBe(false);
    expect(frameMatchesViewport({ width: 1920, height: 0 }, { width: 1440, height: 900 })).toBe(false);
  });
});

describe("choosing an encoding", () => {
  it("stops at a result of the requested type under ~500 KB", () => {
    expect(meetsTarget({ type: "image/webp", size: TARGET_IMAGE_BYTES }, "image/webp")).toBe(true);
    expect(meetsTarget({ type: "image/webp", size: TARGET_IMAGE_BYTES + 1 }, "image/webp")).toBe(false);
    // The browser fell back to PNG: not what was asked for.
    expect(meetsTarget({ type: "image/png", size: 10 }, "image/webp")).toBe(false);
  });

  it("keeps the smallest accepted result under 3 MB", () => {
    const picked = pickEncoding([
      { type: "image/webp", size: 900_000 },
      { type: "image/jpeg", size: 700_000 },
      { type: "image/gif", size: 10 },
    ]);
    expect(picked).toEqual({ type: "image/jpeg", size: 700_000 });
  });

  it("is null when even the smallest is over the server's limit", () => {
    expect(pickEncoding([{ type: "image/webp", size: MAX_IMAGE_BYTES + 1 }])).toBeNull();
    expect(pickEncoding([])).toBeNull();
  });
});

describe("sniffImageType", () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
  const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1];
  const webp = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

  it("reads PNG, JPEG and WebP from their first bytes", () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(Uint8Array.from(jpeg))).toBe("image/jpeg");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("refuses anything else, whatever its name says", () => {
    const gif = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
    const riffNotWebp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20];
    const svg = Array.from("<svg xmlns=", (char) => char.charCodeAt(0));
    expect(sniffImageType(gif)).toBeNull();
    expect(sniffImageType(riffNotWebp)).toBeNull();
    expect(sniffImageType(svg)).toBeNull();
    expect(sniffImageType([0x89, 0x50])).toBeNull();
    expect(sniffImageType([])).toBeNull();
  });

  it("knows which types the server takes", () => {
    expect(isQaImageType("image/webp")).toBe(true);
    expect(isQaImageType("image/gif")).toBe(false);
  });
});

describe("file names and pasted files", () => {
  it("names a file by type and time", () => {
    const at = new Date(2026, 9, 14, 9, 5, 2);
    expect(evidenceFileName("image/webp", at)).toBe("evidence-20261014-090502.webp");
    expect(evidenceFileName("image/jpeg", at)).toBe("evidence-20261014-090502.jpg");
    expect(evidenceFileName("image/png", at)).toBe("evidence-20261014-090502.png");
  });

  it("finds the first image among a clipboard's files", () => {
    expect(firstImageIndex(["text/plain", "image/png", "image/jpeg"])).toBe(1);
    expect(firstImageIndex(["text/plain"])).toBe(-1);
    expect(firstImageIndex([])).toBe(-1);
  });
});
