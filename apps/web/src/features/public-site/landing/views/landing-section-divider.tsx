"use client";

import { motion } from "framer-motion";

/* Written out literally at both call sites below rather than hoisted into a
   const — Tailwind's JIT scans source text for complete class strings, so an
   interpolated `bg-[${RAIL}]` would never get generated. */
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

interface LandingSectionDividerProps {
  reduced?: boolean;
}

/* Draw-in divider. Six of these mount on the landing page.
   ────────────────────────────────────────────────────────
   Previously each ran `useScroll({ target, offset })` + `useSpring` + three
   `useTransform`s, re-resolving its offsets against the element box on every
   scroll event. Like MorphReveal, the animation only ever plays forward once,
   so an IntersectionObserver (`whileInView`) does the same job with no
   per-frame work.

   The glow dot also used to animate `left`, which is a layout property. It now
   rides a full-width track translated by `x` instead — a percentage `x` on a
   full-width element covers the same distance as the old percentage `left`
   (percentages on transforms resolve against the element's own box, so the
   track has to be full-width for the maths to match), but stays on the
   compositor. */
export function LandingSectionDivider({ reduced = false }: Readonly<LandingSectionDividerProps>) {
  if (reduced) {
    return (
      <hr
        className="m-0 h-px w-full border-0 bg-[linear-gradient(90deg,transparent_0%,var(--border-brand)_30%,rgba(0,208,132,0.3)_60%,transparent_100%)]"
        data-landing-section-divider="true"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="relative h-px w-full overflow-visible" data-landing-section-divider="true" aria-hidden="true">
      <motion.div
        className="absolute inset-0 origin-center bg-[linear-gradient(90deg,transparent_0%,var(--border-brand)_30%,rgba(0,208,132,0.3)_60%,transparent_100%)]"
        initial={{ scaleX: 0.1, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -18% 0px" }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      <motion.div
        className="absolute inset-0"
        initial={{ x: "-10%", opacity: 0 }}
        whileInView={{ x: "110%", opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -18% 0px" }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <span className="absolute left-0 top-1/2 size-[5px] -translate-y-1/2 rounded-full bg-[var(--brand)] shadow-[0_0_14px_color-mix(in_srgb,var(--brand)_80%,transparent),0_0_28px_rgba(52,211,153,0.4)]" />
      </motion.div>
    </div>
  );
}


