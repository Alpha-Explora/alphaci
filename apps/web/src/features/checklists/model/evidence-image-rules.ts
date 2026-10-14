/* The arithmetic behind a screenshot: which part of a captured frame is the
 * QA Studio preview, how far to shrink it, which encoding to keep, and what a
 * file really is. Pure: no React, no DOM, no canvas. The browser work that
 * uses these lives in data/evidence-capture-repository.ts. */

import type { QaImageType } from "./qa-attachment-types";

/** The longest side an uploaded image keeps; larger ones are scaled down. */
export const MAX_IMAGE_SIDE = 2560;

/** A second, smaller try when the first sizes still encode too large. */
export const FALLBACK_IMAGE_SIDE = 1920;

/** The size compression aims for. */
export const TARGET_IMAGE_BYTES = 500 * 1024;

/** The server's hard limit (and the client's after compression). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** The server's pixel limit on either side. */
export const MAX_IMAGE_PIXELS = 8000;

/** WebP first, JPEG where the browser cannot encode WebP. Highest quality first. */
export const ENCODE_TYPES: ReadonlyArray<Extract<QaImageType, "image/webp" | "image/jpeg">> = [
  "image/webp",
  "image/jpeg",
];
export const ENCODE_QUALITIES: ReadonlyArray<number> = [0.85, 0.7, 0.55];
export const ENCODE_SIDES: ReadonlyArray<number> = [MAX_IMAGE_SIDE, FALLBACK_IMAGE_SIDE];

export interface Size {
  width: number;
  height: number;
}

/** An element's on-screen box, in CSS pixels (a DOMRect's fields). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A source rectangle in the captured frame's own pixels. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ── Scaling ────────────────────────────────────────────────────────────── */

/** The size that fits within `maxSide` on both sides, keeping the aspect ratio. Never upscales. */
export function fitWithin(size: Size, maxSide: number = MAX_IMAGE_SIDE): Size {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** True when the image is beyond what the server accepts in pixels. */
export function exceedsPixelLimit(size: Size): boolean {
  return size.width > MAX_IMAGE_PIXELS || size.height > MAX_IMAGE_PIXELS;
}

/* ── Cropping a captured tab to the preview ─────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The preview's rectangle inside a captured frame of the whole tab.
 *
 * The frame is the tab's viewport at the capture's own resolution (device
 * pixels, or scaled down by the browser), so the element's CSS box is scaled
 * by frame/viewport on each axis, rounded outward to whole pixels and clamped
 * to the frame. Null when nothing of the element is on screen.
 */
export function cropRect(element: Box, viewport: Size, frame: Size): CropRect | null {
  if (viewport.width <= 0 || viewport.height <= 0 || frame.width <= 0 || frame.height <= 0) return null;
  const sx = frame.width / viewport.width;
  const sy = frame.height / viewport.height;
  const left = clamp(Math.floor(element.left * sx), 0, frame.width);
  const top = clamp(Math.floor(element.top * sy), 0, frame.height);
  const right = clamp(Math.ceil((element.left + element.width) * sx), 0, frame.width);
  const bottom = clamp(Math.ceil((element.top + element.height) * sy), 0, frame.height);
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Whether a frame is this tab's viewport, so a crop by the element's box is
 * right. A tester who picked another tab, a window or a screen (Firefox and
 * Safari always ask) gets a frame of a different shape: that one is kept
 * whole rather than cropped to the wrong place.
 */
export function frameMatchesViewport(frame: Size, viewport: Size, tolerance = 0.02): boolean {
  if (frame.height <= 0 || viewport.height <= 0) return false;
  const frameRatio = frame.width / frame.height;
  const viewportRatio = viewport.width / viewport.height;
  return Math.abs(frameRatio - viewportRatio) / viewportRatio <= tolerance;
}

/* ── Choosing an encoding ───────────────────────────────────────────────── */

export interface EncodedCandidate {
  type: string;
  size: number;
}

/** Good enough to stop trying: small, and the type the browser said it would make. */
export function meetsTarget(candidate: EncodedCandidate, requested: string): boolean {
  return candidate.type === requested && candidate.size <= TARGET_IMAGE_BYTES;
}

/**
 * The one to keep once every try was made: the smallest of an accepted type,
 * or null when even that is over the server's limit (the caller then says the
 * image is too large).
 */
export function pickEncoding<T extends EncodedCandidate>(candidates: ReadonlyArray<T>): T | null {
  const usable = candidates.filter((candidate) => isQaImageType(candidate.type) && candidate.size <= MAX_IMAGE_BYTES);
  const [first, ...rest] = usable;
  if (!first) return null;
  return rest.reduce((best, candidate) => (candidate.size < best.size ? candidate : best), first);
}

/* ── What a file really is ──────────────────────────────────────────────── */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: ArrayLike<number>, signature: ReadonlyArray<number>, offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** How many leading bytes `sniffImageType` needs. */
export const SNIFF_BYTES = 12;

/**
 * The image type from the file's first bytes — never from its name or the
 * type the browser guessed (the server checks the same way). Null for
 * anything that is not a PNG, JPEG or WebP.
 */
export function sniffImageType(bytes: ArrayLike<number>): QaImageType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}

export function isQaImageType(value: string): value is QaImageType {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp";
}

const EXTENSIONS: Record<QaImageType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "evidence-20261014-091502.webp": a name the server stores beside the bytes. */
export function evidenceFileName(type: QaImageType, at: Date): string {
  const date = `${String(at.getFullYear())}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `evidence-${date}-${time}.${EXTENSIONS[type]}`;
}

/** The first image among a clipboard's or a drop's files, by the browser's declared type. */
export function firstImageIndex(types: ReadonlyArray<string>): number {
  return types.findIndex((type) => type.startsWith("image/"));
}
