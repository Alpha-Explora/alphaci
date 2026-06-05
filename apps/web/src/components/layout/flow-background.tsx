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
      {/* Aurora orbs — only rendered when motion is allowed */}
      {!reduced && (
        <>
          {/* Orb 1 — blue, top-right */}
          <motion.div
            style={{
              position: "absolute",
              width: "70vw",
              height: "70vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #3b82f6 0%, transparent 70%)",
              filter: "blur(80px)",
              opacity: 0.14,
              top: "-20%",
              right: "-15%",
            }}
            animate={{ x: ["0%", "-8%", "4%", "0%"], y: ["0%", "6%", "-4%", "0%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 2 — violet, top-left */}
          <motion.div
            style={{
              position: "absolute",
              width: "60vw",
              height: "60vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #8b5cf6 0%, transparent 70%)",
              filter: "blur(90px)",
              opacity: 0.12,
              top: "-10%",
              left: "-20%",
            }}
            animate={{ x: ["0%", "10%", "-5%", "0%"], y: ["0%", "8%", "3%", "0%"] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 3 — cyan, bottom-center */}
          <motion.div
            style={{
              position: "absolute",
              width: "55vw",
              height: "55vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #06b6d4 0%, transparent 70%)",
              filter: "blur(100px)",
              opacity: 0.1,
              bottom: "-15%",
              left: "25%",
            }}
            animate={{ x: ["0%", "-6%", "8%", "0%"], y: ["0%", "-5%", "3%", "0%"] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orb 4 — emerald, bottom-right */}
          <motion.div
            style={{
              position: "absolute",
              width: "50vw",
              height: "50vw",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, #10b981 0%, transparent 70%)",
              filter: "blur(85px)",
              opacity: 0.1,
              bottom: "-10%",
              right: "-10%",
            }}
            animate={{ x: ["0%", "5%", "-8%", "0%"], y: ["0%", "-7%", "4%", "0%"] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* Dot grid — always shown */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.18,
          pointerEvents: "none",
        }}
      >
        <defs>
          <pattern id="dot-grid-bg" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(148, 163, 184, 0.5)" />
          </pattern>
          <radialGradient id="dot-fade-bg" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="dot-mask-bg">
            <rect width="100%" height="100%" fill="url(#dot-fade-bg)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid-bg)" mask="url(#dot-mask-bg)" />
      </svg>

      {/* Horizontal scan line — subtle sweep */}
      {!reduced && (
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 5%, rgba(56,189,248,0.35) 30%, rgba(139,92,246,0.3) 60%, transparent 95%)",
            pointerEvents: "none",
          }}
          initial={{ top: "0%" }}
          animate={{ top: ["0%", "100%"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
        />
      )}
    </div>
  );
}
