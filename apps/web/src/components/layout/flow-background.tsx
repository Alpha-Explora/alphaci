"use client";

import { type CSSProperties } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useTheme } from "@/lib/theme-context";

/* FlowBackground
   ──────────────
   - Dark mode  : aurora orbs animated via pure CSS keyframes (compositor thread,
                  no JS frame budget), wrapped in a single motion layer so they
                  gain scroll parallax like everything else.
   - Light mode : framer-motion animated orbs tuned for a light palette, each with
                  a continuous idle drift PLUS a scroll-linked parallax offset.
   - Reduced motion: a static aurora gradient for both themes. */

/* ── Scroll parallax depths ──────────────────────────────────────────────────
   These numbers are the "feel" of the scroll effect: how far (in px) each orb
   travels over a full-page scroll. Negative = drifts up, positive = drifts down.
   Larger magnitude = the orb feels "closer" to the viewer (moves more). Tune
   freely — these are the main knobs for how dramatic the scroll motion is. */
const PARALLAX = {
  upSlow: -130, // far background orb, drifts up gently
  downFast: 210, // foreground orb, rushes down (opposite direction = depth)
  upMed: -80,
  downMed: 120,
  darkLayer: -100, // whole dark-mode orb field, subtle upward parallax
  swellTo: 1.22, // scale orbs grow to as you scroll (1 → 1.22)
} as const;

interface OrbProps {
  scrollY: MotionValue<number>;
  scrollScale: MotionValue<number>;
  gradient: string;
  size: string;
  position: CSSProperties;
  idle: { x: number[]; y: number[]; scale: number[] };
  duration: number;
  blur?: number;
  opacity?: number;
}

/* A single light-mode orb: outer layer = scroll parallax, inner = idle drift. */
function LightOrb({
  scrollY,
  scrollScale,
  gradient,
  size,
  position,
  idle,
  duration,
  blur = 64,
  opacity = 0.42,
}: OrbProps) {
  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: "absolute",
        ...position,
        y: scrollY,
        scale: scrollScale,
        willChange: "transform",
      }}
    >
      <motion.div
        animate={{ x: idle.x, y: idle.y, scale: idle.scale }}
        transition={{
          duration,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: gradient,
          filter: `blur(${blur}px)`,
          opacity,
        }}
      />
    </motion.div>
  );
}

const ROOT_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  pointerEvents: "none",
  overflow: "hidden",
  background: "var(--bg-base)",
};

const LIGHT_STATIC_GRADIENT =
  "radial-gradient(ellipse 60% 50% at 78% -8%, rgba(56,189,248,0.30) 0%, transparent 60%)," +
  "radial-gradient(ellipse 50% 45% at 18% 5%, rgba(167,139,250,0.28) 0%, transparent 60%)," +
  "radial-gradient(ellipse 45% 40% at 50% 95%, rgba(52,211,153,0.24) 0%, transparent 60%)";

const DARK_STATIC_GRADIENT =
  "radial-gradient(ellipse 60% 50% at 75% -10%, rgba(59,130,246,0.28) 0%, transparent 60%)," +
  "radial-gradient(ellipse 50% 40% at 20% 0%, rgba(139,92,246,0.25) 0%, transparent 60%)," +
  "radial-gradient(ellipse 40% 35% at 50% 90%, rgba(79,70,229,0.22) 0%, transparent 60%)";

export function FlowBackground() {
  const reduced = useReducedMotion();
  const { theme } = useTheme();
  const isLight = theme === "light";

  // Scroll progress drives every parallax transform below. Hooks must run
  // unconditionally, so we build them before any early return.
  const { scrollYProgress } = useScroll();
  const driftUpSlow = useTransform(scrollYProgress, [0, 1], [0, PARALLAX.upSlow]);
  const driftDownFast = useTransform(scrollYProgress, [0, 1], [0, PARALLAX.downFast]);
  const driftUpMed = useTransform(scrollYProgress, [0, 1], [0, PARALLAX.upMed]);
  const driftDownMed = useTransform(scrollYProgress, [0, 1], [0, PARALLAX.downMed]);
  const swellScale = useTransform(scrollYProgress, [0, 1], [1, PARALLAX.swellTo]);
  const darkParallax = useTransform(scrollYProgress, [0, 1], [0, PARALLAX.darkLayer]);

  // Reduced motion → static gradient, no animation, no scroll coupling.
  if (reduced) {
    return (
      <div className="flow-bg" aria-hidden="true" style={{ ...ROOT_STYLE, opacity: 1 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isLight ? LIGHT_STATIC_GRADIENT : DARK_STATIC_GRADIENT,
          }}
        />
      </div>
    );
  }

  if (isLight) {
    return (
      // opacity:1 inline overrides `[data-theme="light"] .flow-bg { opacity:.18 }`
      <div className="flow-bg" aria-hidden="true" style={{ ...ROOT_STYLE, opacity: 1 }}>
        {/* Sky — top-right, drifts up slowly + swells on scroll */}
        <LightOrb
          scrollY={driftUpSlow}
          scrollScale={swellScale}
          gradient="radial-gradient(circle, #38bdf8 0%, #0ea5e9 45%, transparent 70%)"
          size="58vw"
          position={{ top: "-16%", right: "-12%" }}
          idle={{ x: [0, 40, -20, 0], y: [0, -28, 18, 0], scale: [1, 1.06, 0.98, 1] }}
          duration={22}
          opacity={0.4}
        />
        {/* Violet — top-left, rushes down (opposite direction reads as depth) */}
        <LightOrb
          scrollY={driftDownFast}
          scrollScale={swellScale}
          gradient="radial-gradient(circle, #a78bfa 0%, #7c3aed 45%, transparent 70%)"
          size="52vw"
          position={{ top: "-10%", left: "-16%" }}
          idle={{ x: [0, -34, 22, 0], y: [0, 26, -16, 0], scale: [1, 1.05, 0.97, 1] }}
          duration={26}
          opacity={0.38}
        />
        {/* Emerald — bottom-left */}
        <LightOrb
          scrollY={driftUpMed}
          scrollScale={swellScale}
          gradient="radial-gradient(circle, #34d399 0%, #059669 45%, transparent 70%)"
          size="48vw"
          position={{ bottom: "-14%", left: "10%" }}
          idle={{ x: [0, 30, -24, 0], y: [0, -20, 24, 0], scale: [1, 1.07, 0.96, 1] }}
          duration={30}
          opacity={0.34}
        />
        {/* Warm rose/amber — bottom-right accent */}
        <LightOrb
          scrollY={driftDownMed}
          scrollScale={swellScale}
          gradient="radial-gradient(circle, #fbbf24 0%, #fb7185 52%, transparent 72%)"
          size="44vw"
          position={{ bottom: "-12%", right: "-10%" }}
          idle={{ x: [0, -26, 18, 0], y: [0, 22, -18, 0], scale: [1, 1.06, 0.98, 1] }}
          duration={24}
          blur={56}
          opacity={0.3}
        />
        {/* Dot-grid texture — dark dots read well on the light base */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(15,23,42,0.05) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>
    );
  }

  // Dark mode — keep the CSS-keyframe orbs, wrapped in one motion layer that
  // shifts with scroll. CSS keyframes stay on the compositor thread.
  return (
    <div className="flow-bg" aria-hidden="true" style={ROOT_STYLE}>
      <motion.div
        style={{ position: "absolute", inset: 0, y: darkParallax, willChange: "transform" }}
      >
        {/* Orb 1 — blue, top-right */}
        <div style={{
          position: "absolute",
          width: "85vw",
          height: "85vw",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #3b82f6 0%, #1d4ed8 40%, transparent 70%)",
          filter: "blur(60px)",
          opacity: 0.20,
          top: "-22%",
          right: "-18%",
          animation: "orb-drift-a 20s ease-in-out infinite",
        }} />

        {/* Orb 2 — violet, top-left */}
        <div style={{
          position: "absolute",
          width: "75vw",
          height: "75vw",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #8b5cf6 0%, #6d28d9 45%, transparent 70%)",
          filter: "blur(60px)",
          opacity: 0.22,
          top: "-12%",
          left: "-22%",
          animation: "orb-drift-b 26s ease-in-out infinite",
        }} />

        {/* Orb 3 — cyan, bottom-center-left */}
        <div style={{
          position: "absolute",
          width: "70vw",
          height: "70vw",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #06b6d4 0%, #0284c7 45%, transparent 70%)",
          filter: "blur(60px)",
          opacity: 0.18,
          bottom: "-18%",
          left: "22%",
          animation: "orb-drift-c 30s ease-in-out infinite",
        }} />

        {/* Orb 4 — emerald, bottom-right */}
        <div style={{
          position: "absolute",
          width: "62vw",
          height: "62vw",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #10b981 0%, #059669 45%, transparent 70%)",
          filter: "blur(52px)",
          opacity: 0.16,
          bottom: "-12%",
          right: "-12%",
          animation: "orb-drift-d 24s ease-in-out infinite",
        }} />

        {/* Orb 5 — deep indigo, center-bottom anchor */}
        <div style={{
          position: "absolute",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #4f46e5 0%, #3730a3 50%, transparent 70%)",
          filter: "blur(52px)",
          opacity: 0.16,
          bottom: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          animation: "orb-pulse-e 18s ease-in-out infinite",
        }} />

        {/* Dot-grid texture overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
      </motion.div>
    </div>
  );
}
