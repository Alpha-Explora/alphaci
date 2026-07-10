"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme-context";

/* DitherBackground
   ────────────────
   A retro ordered-dither (Bayer 8x8) field rendered on a downscaled canvas and
   upscaled by CSS with `image-rendering: pixelated` for crisp chunky pixels.

   Two independent signals decide whether each pixel's dot is "on":
     1. An AMBIENT field — a few slow sine waves that drift on their own. This is
        the continuous background animation; it never reacts to the cursor.
     2. A LOCAL cursor ripple — concentric rings that only exist inside a falloff
        radius around the pointer. Outside that radius its contribution is ~0, so
        moving the mouse ripples the area *around the cursor* instead of dragging
        the whole field toward it (the old behaviour that made the page "move").

   The dot is drawn when (ambient + ripple) clears the Bayer threshold for that
   pixel — that comparison is what turns a smooth gradient into a dither pattern.

   Reduced motion: no animation loop, no pointer coupling — a single static
   dithered frame is painted once. */

// Bayer 8x8 ordered-dither threshold map (values 0..63). Tiling this over the
// low-res grid is what produces the classic cross-hatched retro texture.
const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52,
  11, 59, 7, 55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22,
  41, 25, 37, 21,
];

// Screen pixels per dither cell. Larger = chunkier / more retro, cheaper to draw.
const CELL = 6;

export function DitherBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isLight = theme === "light";
    // Azure accent on the dark graphite surface; darker graphite dots on light.
    const dot = isLight ? [55, 55, 68] : [88, 166, 255];
    const baseAlpha = isLight ? 30 : 42;
    const peakAlpha = isLight ? 70 : 95;

    let width = 0;
    let height = 0;
    let imageData: ImageData | null = null;
    let frame = 0;

    // Eased pointer state — all in low-res canvas pixel space.
    const target = { x: -9999, y: -9999 };
    const pointer = { x: -9999, y: -9999 };
    let energy = 0; // 0 = idle (ambient only), 1 = fully engaged ripple
    let lastMove = -9999;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.ceil(rect.width / CELL));
      height = Math.max(1, Math.ceil(rect.height / CELL));
      canvas.width = width;
      canvas.height = height;
      imageData = context.createImageData(width, height);
    };

    const movePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      target.x = ((event.clientX - rect.left) / rect.width) * width;
      target.y = ((event.clientY - rect.top) / rect.height) * height;
      lastMove = performance.now();
    };

    const draw = (time: number) => {
      if (!imageData) return;
      const pixels = imageData.data;
      const t = reducedMotion.matches ? 0 : time * 0.001;

      // Cursor engagement: rise while the mouse is moving, decay ~0.8s after it
      // stops so the ripple gently fades to "ambient only" — never a hard jump.
      const engaged = !reducedMotion.matches && time - lastMove < 800;
      energy += ((engaged ? 1 : 0) - energy) * 0.08;
      pointer.x += (target.x - pointer.x) * 0.12;
      pointer.y += (target.y - pointer.y) * 0.12;

      // Ripple falloff radius, in low-res pixels (~20% of the field width).
      const radius = width * 0.2;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const nx = x / width;
          const ny = y / height;

          // (1) Ambient drifting field, centred around ~0.42 density.
          const ambient =
            0.42 +
            0.17 * Math.sin(nx * 6.0 + t * 0.6) +
            0.15 * Math.cos(ny * 5.0 - t * 0.45) +
            0.12 * Math.sin((nx + ny) * 7.0 + t * 0.3);

          // (2) Local cursor ripple — concentric rings, killed by exp falloff so
          // it only lives near the pointer. energy fades it in/out.
          let ripple = 0;
          if (energy > 0.01) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const falloff = Math.exp(-dist / (radius * 0.5));
            ripple =
              Math.sin(dist * 0.35 - t * 3.0) * falloff * energy * 0.5;
          }

          const brightness = ambient + ripple;
          const threshold = (BAYER_8[(y & 7) * 8 + (x & 7)] + 0.5) / 64;

          if (brightness > threshold) {
            // Soft intensity above the threshold → alpha, for a bit of depth.
            const intensity = Math.min((brightness - threshold) * 3, 1);
            pixels[index] = dot[0];
            pixels[index + 1] = dot[1];
            pixels[index + 2] = dot[2];
            pixels[index + 3] = baseAlpha + intensity * (peakAlpha - baseAlpha);
          } else {
            pixels[index + 3] = 0;
          }
        }
      }

      context.putImageData(imageData, 0, 0);
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (reducedMotion.matches) {
      // Static single frame — no animation, no pointer coupling.
      draw(0);
    } else {
      window.addEventListener("pointermove", movePointer, { passive: true });
      frame = window.requestAnimationFrame(draw);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", movePointer);
      window.cancelAnimationFrame(frame);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="auth-dither-background"
      aria-hidden="true"
    />
  );
}
