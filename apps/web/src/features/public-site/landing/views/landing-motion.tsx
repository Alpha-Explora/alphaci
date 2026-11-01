"use client";

import { useState, type ReactNode } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

import { cn } from "@/shared/ui/cn";

/**
 * Shared premium-motion primitives for the landing page.
 *
 * MorphReveal      — one-shot section reveal (opacity/y/scale) fired by an
 *                    IntersectionObserver as the section enters the viewport.
 * MorphingBlob     — organic gradient blob whose border-radius slowly morphs.
 * ScrollProgressBar — thin spring-smoothed progress rail fixed to the top edge.
 *                    This one is a genuine scrub, but it uses viewport
 *                    `useScroll()` with no target, which only reads scrollY and
 *                    never measures an element — cheap, so it stays as-is.
 *
 * All primitives no-op (render static) when `reduced` is truthy.
 */

type Reduced = boolean | null | undefined;

/** Shared easing for landing entrances — matches the hero's curve. */
const heroEase: [number, number, number, number] = [0.25, 1, 0.5, 1];

interface MorphRevealProps {
  children: ReactNode;
  reduced?: Reduced;
  className?: string;
}

/* One-shot entrance, not a scroll scrub.
   ──────────────────────────────────────
   This used to run `useScroll({ target, offset })` + `useSpring` + three
   `useTransform`s. Eight of these mount on the landing page, and each one
   re-resolves its offsets against the target's box on every scroll event —
   which Lenis emits on nearly every frame. In a traced 5s scroll that machinery
   was the single largest main-thread JS cost.

   The animation itself is 0->1 opacity, 64->0 y, 0.965->1 scale: it plays once
   on entry and never reverses. `whileInView` expresses exactly that through an
   IntersectionObserver, which costs nothing per frame. Same look, no scroll
   handler.

   Note there is no `will-change-transform` any more either — it was pinning a
   compositing layer for all eight wrappers permanently. framer-motion sets
   will-change itself for the duration of the animation and clears it after. */
export function MorphReveal({ children, reduced = false, className }: Readonly<MorphRevealProps>) {
  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 64, scale: 0.965 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.6, ease: heroEase }}
      data-morph-reveal="true"
    >
      {children}
    </motion.div>
  );
}

type BlobTone = "brand" | "accent" | "violet" | "amber" | "rose";

const BLOB_TONES: Record<BlobTone, string> = {
  brand: "bg-[radial-gradient(circle_at_35%_35%,color-mix(in_srgb,var(--brand)_16%,transparent),color-mix(in_srgb,var(--brand-strong)_5%,transparent)_60%,transparent_75%)]",
  accent: "bg-[radial-gradient(circle_at_35%_35%,rgba(52,211,153,0.14),rgba(16,185,129,0.04)_60%,transparent_75%)]",
  violet: "bg-[radial-gradient(circle_at_35%_35%,rgba(167,139,250,0.14),rgba(124,58,237,0.05)_60%,transparent_75%)]",
  amber: "bg-[radial-gradient(circle_at_35%_35%,rgba(251,191,36,0.12),rgba(245,158,11,0.04)_60%,transparent_75%)]",
  rose: "bg-[radial-gradient(circle_at_35%_35%,rgba(244,114,182,0.12),rgba(219,39,119,0.04)_60%,transparent_75%)]",
};

type AvatarTone = "brand" | "accent" | "violet" | "amber" | "rose";

const AVATAR_GRADIENTS: Record<AvatarTone, string> = {
  brand: "bg-[linear-gradient(135deg,var(--brand),var(--brand-strong))]",
  accent: "bg-[linear-gradient(135deg,#34d399,#10b981)]",
  violet: "bg-[linear-gradient(135deg,#a78bfa,#7c3aed)]",
  amber: "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)]",
  rose: "bg-[linear-gradient(135deg,#f472b6,#db2777)]",
};

interface PersonAvatarProps {
  /** Path under /public, e.g. "/people/lloyd.jpg". Falls back to `fallbackPhoto`, then initials. */
  photo?: string;
  /** Real stock photograph shown while the team photo isn't dropped in /public/people/ yet. */
  fallbackPhoto?: string;
  initials: string;
  name: string;
  tone?: AvatarTone;
  className?: string;
  /** Ring color matched to the surrounding surface. */
  ringClassName?: string;
}

/**
 * Real-person photo with a graceful fallback chain: own photo (drop headshots in
 * /public/people/) → real stock photograph → colored initials. Real human faces
 * show by default so the page never looks machine-generated.
 */
export function PersonAvatar({ photo, fallbackPhoto, initials, name, tone = "brand", className, ringClassName = "ring-white/10" }: Readonly<PersonAvatarProps>) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const src = photo && !primaryFailed ? photo : fallbackPhoto && !fallbackFailed ? fallbackPhoto : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => (src === photo ? setPrimaryFailed(true) : setFallbackFailed(true))}
        className={cn("shrink-0 rounded-full object-cover ring-2", ringClassName, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-[var(--font-dash-display),system-ui,sans-serif] font-extrabold text-brand-foreground ring-2",
        AVATAR_GRADIENTS[tone],
        ringClassName,
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

const BLOB_SHAPES = [
  "42% 58% 62% 38% / 46% 42% 58% 54%",
  "58% 42% 38% 62% / 54% 58% 42% 46%",
  "38% 62% 55% 45% / 60% 38% 62% 40%",
  "42% 58% 62% 38% / 46% 42% 58% 54%",
];

interface MorphingBlobProps {
  reduced?: Reduced;
  tone?: BlobTone;
  className?: string;
  /** Stagger the morph loop so multiple blobs don't pulse in sync. */
  delay?: number;
}

export function MorphingBlob({ reduced = false, tone = "brand", className, delay = 0 }: Readonly<MorphingBlobProps>) {
  return (
    <motion.div
      className={cn("pointer-events-none absolute blur-3xl", BLOB_TONES[tone], className)}
      aria-hidden="true"
      data-morphing-blob="true"
      style={{ borderRadius: BLOB_SHAPES[0] }}
      animate={
        reduced
          ? undefined
          : {
              borderRadius: BLOB_SHAPES,
              rotate: [0, 14, -8, 0],
              scale: [1, 1.08, 0.96, 1],
            }
      }
      transition={reduced ? undefined : { duration: 22, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

interface ScenePhotoProps {
  /** Real photograph URL (local /public path or remote). */
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Brand duotone wash so photos sit naturally in the dark theme. */
  overlay?: boolean;
}

/**
 * A real photograph in a clean rectangular frame (rounded corners come from
 * `className`). A subtle duotone overlay keeps it matching the dark theme.
 * On load failure a gradient panel holds the layout — never a broken image box.
 */
export function ScenePhoto({ src, alt, className, imgClassName, overlay = true }: Readonly<ScenePhotoProps>) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)} data-scene-photo="true">
      {failed ? (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#1c1c22,#0f0f13)]" aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("size-full object-cover", imgClassName)} />
      )}
      {overlay && (
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(9,9,11,0.3)_0%,color-mix(in_srgb,var(--brand)_6%,transparent)_55%,rgba(9,9,11,0.4)_100%)] mix-blend-multiply"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

interface ScrollProgressBarProps {
  reduced?: Reduced;
}

export function ScrollProgressBar({ reduced = false }: Readonly<ScrollProgressBarProps>) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  if (reduced) {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-[90] h-[2px] origin-left bg-[linear-gradient(90deg,var(--brand),var(--brand-accent))] shadow-[0_0_12px_color-mix(in_srgb,var(--brand)_45%,transparent)]"
      style={{ scaleX }}
      aria-hidden="true"
      data-scroll-progress-bar="true"
    />
  );
}


