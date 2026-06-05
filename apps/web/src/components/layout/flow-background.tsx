"use client";
import { motion, useReducedMotion } from "framer-motion";

/* FlowBackground — Aurora orbs + dot-grid mesh + horizontal scan line */
export function FlowBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Noise grain texture — premium feel, always shown */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.038,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
      >
        <filter id="noise-bg">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.72"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise-bg)" />
      </svg>

      {/* Aurora orbs — only rendered when motion is allowed */}
      {!reduced && (
        <>
          {/* Orb 1 — blue, top-right */}
          <motion.div
            style={{
              position: "absolute",
              width: "72vw",
              height: "72vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #3b82f6 0%, #1d4ed8 40%, transparent 70%)",
              filter: "blur(72px)",
              opacity: 0.22,
              top: "-22%",
              right: "-18%",
            }}
            animate={{ x: ["0%", "-8%", "4%", "0%"], y: ["0%", "6%", "-4%", "0%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 2 — violet, top-left */}
          <motion.div
            style={{
              position: "absolute",
              width: "64vw",
              height: "64vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #8b5cf6 0%, #6d28d9 45%, transparent 70%)",
              filter: "blur(80px)",
              opacity: 0.2,
              top: "-12%",
              left: "-22%",
            }}
            animate={{ x: ["0%", "10%", "-5%", "0%"], y: ["0%", "8%", "3%", "0%"] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 3 — cyan, bottom-center */}
          <motion.div
            style={{
              position: "absolute",
              width: "58vw",
              height: "58vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #06b6d4 0%, #0284c7 45%, transparent 70%)",
              filter: "blur(90px)",
              opacity: 0.18,
              bottom: "-18%",
              left: "22%",
            }}
            animate={{ x: ["0%", "-6%", "8%", "0%"], y: ["0%", "-5%", "3%", "0%"] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 4 — emerald, bottom-right */}
          <motion.div
            style={{
              position: "absolute",
              width: "52vw",
              height: "52vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #10b981 0%, #059669 45%, transparent 70%)",
              filter: "blur(78px)",
              opacity: 0.16,
              bottom: "-12%",
              right: "-12%",
            }}
            animate={{ x: ["0%", "5%", "-8%", "0%"], y: ["0%", "-7%", "4%", "0%"] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 5 — deep indigo, center-bottom anchor */}
          <motion.div
            style={{
              position: "absolute",
              width: "50vw",
              height: "50vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #4f46e5 0%, #3730a3 50%, transparent 70%)",
              filter: "blur(96px)",
              opacity: 0.14,
              bottom: "5%",
              left: "50%",
              transform: "translateX(-50%)",
            }}
            animate={{ scale: [1, 1.06, 0.97, 1], opacity: [0.14, 0.2, 0.12, 0.14] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* Static aurora glow — shown even with reduced motion */}
      {reduced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 50% at 75% -10%, rgba(59,130,246,0.18) 0%, transparent 60%)," +
              "radial-gradient(ellipse 50% 40% at 20% 0%, rgba(139,92,246,0.15) 0%, transparent 60%)," +
              "radial-gradient(ellipse 40% 35% at 50% 90%, rgba(79,70,229,0.12) 0%, transparent 60%)",
          }}
        />
      )}

    </div>
  );
}
