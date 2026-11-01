import {
  cropRect,
  ENCODE_QUALITIES,
  ENCODE_SIDES,
  ENCODE_TYPES,
  fitWithin,
  frameMatchesViewport,
  meetsTarget,
  pickEncoding,
  SNIFF_BYTES,
  sniffImageType,
  type CropRect,
  type Size,
} from "../model/evidence-image-rules";
import type { EvidenceImage, QaImageType } from "../model/qa-attachment-types";

/* The browser side of a screenshot: the Screen Capture API, decoding a pasted
 * or chosen file, and the canvas that shrinks and re-encodes it. Device I/O,
 * so it lives in data/ beside the repositories; every decision it makes
 * (crop, size, encoding, file type) is a pure rule in
 * model/evidence-image-rules.ts.
 *
 * The QA Studio preview is a cross-origin iframe: the page cannot read its
 * pixels, so a capture goes through getDisplayMedia (one frame, every track
 * stopped at once) and is cropped to the iframe. */

/** A failure the view maps to a product sentence by its code. */
function imageError(code: string, message: string): Error {
  return Object.assign(new Error(message), { details: { code } });
}

/* ── Feature detection ──────────────────────────────────────────────────── */

/** Capture is offered only where the browser has getDisplayMedia (not on most phones). */
export function supportsScreenCapture(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/* Region Capture (Chromium) is not in the DOM typings yet. */
type CropTargetLike = object;
type CropTargetStatic = { fromElement: (element: Element) => Promise<CropTargetLike> };
type CroppableTrack = MediaStreamTrack & { cropTo?: (target: CropTargetLike) => Promise<void> };
type ImageCaptureLike = { grabFrame: () => Promise<ImageBitmap> };
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

function regionCapture(): CropTargetStatic | null {
  const target = (globalThis as { CropTarget?: CropTargetStatic }).CropTarget;
  return target && typeof target.fromElement === "function" ? target : null;
}

function imageCaptureCtor(): ImageCaptureCtor | null {
  const ctor = (globalThis as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  return typeof ctor === "function" ? ctor : null;
}

/* ── Canvas ─────────────────────────────────────────────────────────────── */

type Drawable = CanvasImageSource & Partial<Size>;

function canvasOf(size: Size): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw imageError("QA_ATTACHMENT_TYPE", "This browser cannot draw the image.");
  return { canvas, context };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** One region of a source, drawn at `output` size. */
function drawRegion(source: Drawable, region: CropRect, output: Size): HTMLCanvasElement {
  const { canvas, context } = canvasOf(output);
  context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, output.width, output.height);
  return canvas;
}

type Candidate = EvidenceImage & { size: number };

/** Every quality of one type at one size, stopping at the first small enough. */
async function encodeAt(canvas: HTMLCanvasElement, type: string, tried: Candidate[]): Promise<Candidate | null> {
  for (const quality of ENCODE_QUALITIES) {
    const blob = await toBlob(canvas, type, quality);
    // The browser fell back to PNG: it cannot encode this type, so stop trying it.
    if (!blob || blob.type !== type) return null;
    const candidate = { blob, type: type as QaImageType, width: canvas.width, height: canvas.height, size: blob.size };
    tried.push(candidate);
    if (meetsTarget(candidate, type)) return candidate;
  }
  return null;
}

/**
 * Shrink so the longest side is at most 2560px, re-encode as WebP (JPEG where
 * WebP cannot be encoded) and keep the first result under ~500 KB, else the
 * smallest under 3 MB. Over that, the image is too large.
 */
export async function compressImage(source: Drawable, region: CropRect): Promise<EvidenceImage> {
  const tried: Candidate[] = [];
  for (const side of ENCODE_SIDES) {
    const canvas = drawRegion(source, region, fitWithin(region, side));
    for (const type of ENCODE_TYPES) {
      const done = await encodeAt(canvas, type, tried);
      if (done) return done;
    }
  }
  const best = pickEncoding(tried);
  if (!best) throw imageError("QA_ATTACHMENT_TOO_LARGE", "The image is too large even after compression.");
  return best;
}

/* ── A pasted or chosen file ────────────────────────────────────────────── */

async function headBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
}

/** Decode a file into something the canvas can draw. */
async function decode(file: Blob): Promise<Drawable & Size> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return Object.assign(image, { width: image.naturalWidth, height: image.naturalHeight });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A PNG, JPEG or WebP the tester pasted or picked, checked by its bytes and compressed. */
export async function imageFromFile(file: Blob): Promise<EvidenceImage> {
  if (!sniffImageType(await headBytes(file))) {
    throw imageError("QA_ATTACHMENT_TYPE", "The file is not a PNG, JPEG or WebP image.");
  }
  const decoded = await decode(file);
  return compressImage(decoded, { x: 0, y: 0, width: decoded.width, height: decoded.height });
}

/* ── Capture ────────────────────────────────────────────────────────────── */

function displayMediaOptions(): DisplayMediaStreamOptions {
  // preferCurrentTab and selfBrowserSurface are Chromium hints; other browsers ignore them.
  return {
    video: { displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  } as DisplayMediaStreamOptions;
}

/** Crop the track itself to the element (Region Capture). False where unsupported or refused. */
async function cropTrackTo(track: CroppableTrack, element: Element): Promise<boolean> {
  const target = regionCapture();
  if (!target || typeof track.cropTo !== "function") return false;
  try {
    await track.cropTo(await target.fromElement(element));
    return true;
  } catch {
    return false;
  }
}

/** Wait for a frame to be painted, so the first grab is not blank. */
function nextFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const withCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    if (typeof withCallback.requestVideoFrameCallback === "function") withCallback.requestVideoFrameCallback(() => resolve());
    else window.setTimeout(resolve, 120);
  });
}

/** One frame of the stream, by ImageCapture where it exists, else a <video> drawn once. */
async function grabFrame(stream: MediaStream, track: MediaStreamTrack): Promise<Drawable & Size> {
  const Ctor = imageCaptureCtor();
  if (Ctor) return new Ctor(track).grabFrame();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  await nextFrame(video);
  return Object.assign(video, { width: video.videoWidth, height: video.videoHeight });
}

function viewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Where the element sits in an uncropped frame of the tab; the whole frame when that cannot be known. */
function regionFor(element: Element, frame: Size): CropRect {
  const whole = { x: 0, y: 0, width: frame.width, height: frame.height };
  const viewport = viewportSize();
  if (!frameMatchesViewport(frame, viewport)) return whole;
  return cropRect(element.getBoundingClientRect(), viewport, frame) ?? whole;
}

/**
 * Ask the browser to share this tab, take ONE frame, stop sharing at once and
 * return the part showing `element` (the preview iframe), compressed. The
 * browser's own prompt decides what is shared; a cancelled prompt rejects
 * with a NotAllowedError, which the caller treats as "nothing to say".
 */
export async function captureElement(element: Element): Promise<EvidenceImage> {
  const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions());
  try {
    const [track] = stream.getVideoTracks();
    if (!track) throw new Error("The shared screen had no video.");
    const cropped = await cropTrackTo(track, element);
    const frame = await grabFrame(stream, track);
    const region = cropped ? { x: 0, y: 0, width: frame.width, height: frame.height } : regionFor(element, frame);
    return await compressImage(frame, region);
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}
