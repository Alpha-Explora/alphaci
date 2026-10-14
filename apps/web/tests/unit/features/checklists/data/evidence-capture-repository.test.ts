import {
  captureElement,
  compressImage,
  imageFromFile,
  supportsScreenCapture,
} from "../../../../../src/features/checklists/data/evidence-capture-repository";
import { MAX_IMAGE_BYTES, TARGET_IMAGE_BYTES } from "../../../../../src/features/checklists/model/evidence-image-rules";
import { errorCode } from "../../../../../src/features/checklists/model/wire-readers";

/* jsdom has no canvas, no Screen Capture and no ImageCapture: each test hands
 * in just enough of them to watch what the adapter asks for. */

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const GIF_HEAD = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];

type Encoder = (type: string, quality: number) => { type: string; size: number } | null;

let drawImage: jest.Mock;
let encodeCalls: Array<{ type: string; quality: number; width: number; height: number }>;

function useCanvas(encode: Encoder) {
  drawImage = jest.fn();
  encodeCalls = [];
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
  );
  jest
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
      encodeCalls.push({ type: type ?? "", quality: quality ?? 0, width: this.width, height: this.height });
      const result = encode(type ?? "", quality ?? 0);
      callback(result ? new Blob([new Uint8Array(result.size)], { type: result.type }) : null);
    });
}

/** A Blob whose first bytes are `head` (jsdom's Blob reads them back through slice + arrayBuffer). */
function fileOf(head: number[], type = "image/png"): Blob {
  return new Blob([new Uint8Array([...head, 1, 2, 3])], { type });
}

const globals = globalThis as Record<string, unknown>;

/* jsdom's Blob has no arrayBuffer(); every browser the app supports does. */
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer === "function") return;
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  delete globals.createImageBitmap;
  delete globals.ImageCapture;
  delete globals.CropTarget;
  Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
});

describe("supportsScreenCapture", () => {
  it("is false without getDisplayMedia, true with it", () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    expect(supportsScreenCapture()).toBe(false);
    Object.defineProperty(navigator, "mediaDevices", { value: { getDisplayMedia: jest.fn() }, configurable: true });
    expect(supportsScreenCapture()).toBe(true);
  });
});

describe("compressImage", () => {
  const region = { x: 0, y: 0, width: 5120, height: 2880 };

  it("draws at most 2560px and keeps the first WebP under ~500 KB", async () => {
    useCanvas((type) => ({ type, size: 200_000 }));
    const image = await compressImage({} as CanvasImageSource, region);
    expect(image).toMatchObject({ type: "image/webp", width: 2560, height: 1440 });
    expect(encodeCalls).toEqual([{ type: "image/webp", quality: 0.85, width: 2560, height: 1440 }]);
    expect(drawImage).toHaveBeenCalledWith({}, 0, 0, 5120, 2880, 0, 0, 2560, 1440);
  });

  it("lowers the quality until it fits", async () => {
    useCanvas((type, quality) => ({ type, size: quality > 0.6 ? TARGET_IMAGE_BYTES + 1 : 300_000 }));
    const image = await compressImage({} as CanvasImageSource, region);
    expect(encodeCalls.map((call) => call.quality)).toEqual([0.85, 0.7, 0.55]);
    expect(image.blob.size).toBe(300_000);
  });

  it("falls back to JPEG where the browser cannot encode WebP", async () => {
    // A browser without a WebP encoder hands back a PNG.
    useCanvas((type) => (type === "image/webp" ? { type: "image/png", size: 10 } : { type, size: 100_000 }));
    const image = await compressImage({} as CanvasImageSource, region);
    expect(image.type).toBe("image/jpeg");
    expect(encodeCalls.map((call) => call.type)).toEqual(["image/webp", "image/jpeg"]);
  });

  it("tries a smaller size, then keeps the smallest result under 3 MB", async () => {
    useCanvas((type) => ({ type, size: 1_000_000 }));
    const image = await compressImage({} as CanvasImageSource, region);
    expect(image.blob.size).toBe(1_000_000);
    expect(new Set(encodeCalls.map((call) => call.width))).toEqual(new Set([2560, 1920]));
  });

  it("says too large when nothing gets under 3 MB", async () => {
    useCanvas((type) => ({ type, size: MAX_IMAGE_BYTES + 1 }));
    const failure = await compressImage({} as CanvasImageSource, region).catch((cause: unknown) => cause);
    expect(errorCode(failure)).toBe("QA_ATTACHMENT_TOO_LARGE");
  });
});

describe("imageFromFile", () => {
  it("refuses a file that is not a PNG, JPEG or WebP by its bytes, whatever its type says", async () => {
    const failure = await imageFromFile(fileOf(GIF_HEAD, "image/png")).catch((cause: unknown) => cause);
    expect(errorCode(failure)).toBe("QA_ATTACHMENT_TYPE");
  });

  it("decodes and compresses an image", async () => {
    globals.createImageBitmap = jest.fn().mockResolvedValue({ width: 1600, height: 1000 });
    useCanvas((type) => ({ type, size: 90_000 }));
    const image = await imageFromFile(fileOf(PNG_HEAD));
    expect(image).toMatchObject({ type: "image/webp", width: 1600, height: 1000 });
  });
});

describe("captureElement", () => {
  function stream(track: Partial<MediaStreamTrack> & Record<string, unknown>) {
    const full = { stop: jest.fn(), ...track } as unknown as MediaStreamTrack;
    return {
      track: full,
      stream: { getVideoTracks: () => [full], getTracks: () => [full] } as unknown as MediaStream,
    };
  }

  function frameElement() {
    const element = document.createElement("iframe");
    element.getBoundingClientRect = () => ({ left: 100, top: 50, width: 800, height: 600 }) as DOMRect;
    return element;
  }

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
    useCanvas((type) => ({ type, size: 120_000 }));
  });

  it("asks for this tab, grabs one frame, crops it to the preview and stops sharing", async () => {
    const shared = stream({});
    const getDisplayMedia = jest.fn().mockResolvedValue(shared.stream);
    Object.defineProperty(navigator, "mediaDevices", { value: { getDisplayMedia }, configurable: true });
    const frame = { width: 2880, height: 1800 };
    globals.ImageCapture = jest.fn().mockImplementation(() => ({ grabFrame: jest.fn().mockResolvedValue(frame) }));

    const image = await captureElement(frameElement());

    expect(getDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({ preferCurrentTab: true, selfBrowserSurface: "include", video: { displaySurface: "browser" } }),
    );
    // The element's CSS box, scaled 2x onto the frame.
    expect(drawImage).toHaveBeenCalledWith(frame, 200, 100, 1600, 1200, 0, 0, 1600, 1200);
    expect(shared.track.stop).toHaveBeenCalled();
    expect(image.type).toBe("image/webp");
  });

  it("keeps the whole frame when another screen or window was shared", async () => {
    const shared = stream({});
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getDisplayMedia: jest.fn().mockResolvedValue(shared.stream) },
      configurable: true,
    });
    const frame = { width: 1920, height: 1080 };
    globals.ImageCapture = jest.fn().mockImplementation(() => ({ grabFrame: jest.fn().mockResolvedValue(frame) }));
    await captureElement(frameElement());
    expect(drawImage).toHaveBeenCalledWith(frame, 0, 0, 1920, 1080, 0, 0, 1920, 1080);
  });

  it("uses Region Capture where the browser has it, and then draws the frame whole", async () => {
    const cropTo = jest.fn().mockResolvedValue(undefined);
    const shared = stream({ cropTo });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getDisplayMedia: jest.fn().mockResolvedValue(shared.stream) },
      configurable: true,
    });
    const target = { id: "crop" };
    globals.CropTarget = { fromElement: jest.fn().mockResolvedValue(target) };
    const frame = { width: 800, height: 600 };
    globals.ImageCapture = jest.fn().mockImplementation(() => ({ grabFrame: jest.fn().mockResolvedValue(frame) }));
    await captureElement(frameElement());
    expect(cropTo).toHaveBeenCalledWith(target);
    expect(drawImage).toHaveBeenCalledWith(frame, 0, 0, 800, 600, 0, 0, 800, 600);
  });

  it("stops sharing even when grabbing the frame fails", async () => {
    const shared = stream({});
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getDisplayMedia: jest.fn().mockResolvedValue(shared.stream) },
      configurable: true,
    });
    globals.ImageCapture = jest.fn().mockImplementation(() => ({ grabFrame: jest.fn().mockRejectedValue(new Error("gone")) }));
    await expect(captureElement(frameElement())).rejects.toThrow("gone");
    expect(shared.track.stop).toHaveBeenCalled();
  });

  it("passes a cancelled prompt through for the caller to ignore", async () => {
    const denied = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getDisplayMedia: jest.fn().mockRejectedValue(denied) },
      configurable: true,
    });
    await expect(captureElement(frameElement())).rejects.toBe(denied);
  });
});
