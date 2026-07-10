"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme-context";

export function DitherBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0.5, y: 0.5 };
    let frame = 0;
    let width = 0;
    let height = 0;
    let imageData: ImageData | null = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.ceil(rect.width / 6));
      height = Math.max(1, Math.ceil(rect.height / 6));
      canvas.width = width;
      canvas.height = height;
      imageData = context.createImageData(width, height);
    };

    const movePointer = (event: PointerEvent) => {
      pointer.x = event.clientX / window.innerWidth;
      pointer.y = event.clientY / window.innerHeight;
    };

    const draw = (time: number) => {
      if (!imageData) return;
      const pixels = imageData.data;
      const isLight = theme === "light";
      const base = isLight ? [55, 55, 68] : [194, 194, 204];
      const speed = reducedMotion.matches ? 0 : time * 0.00065;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const nx = x / width;
          const ny = y / height;
          const distance = Math.hypot(nx - pointer.x, ny - pointer.y);
          const waves =
            Math.sin(nx * 15 + speed + pointer.x * 5) +
            Math.cos(ny * 12 - speed * 0.7 + pointer.y * 4) +
            Math.sin((nx + ny) * 20 - speed * 0.45);
          const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const grain = noise - Math.floor(noise);
          const visible = waves * 0.18 + (1 - Math.min(distance * 1.8, 1)) * 0.34 + grain * 0.28 > 0.42;

          pixels[index] = base[0];
          pixels[index + 1] = base[1];
          pixels[index + 2] = base[2];
          pixels[index + 3] = visible ? (isLight ? 24 : 31) : 0;
        }
      }

      context.putImageData(imageData, 0, 0);
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("pointermove", movePointer, { passive: true });
    resize();
    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", movePointer);
      window.cancelAnimationFrame(frame);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="auth-dither-background" aria-hidden="true" />;
}