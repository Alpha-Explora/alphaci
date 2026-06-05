"use client";

import { useReducedMotion } from "framer-motion";

/* FlowBackground — animated ambient mesh for the dark theme */
export function FlowBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Top-right brand-blue orb — slightly animated */}
      <div
        style={{
          position: "absolute",
          top: "-18%",
          right: "-10%",
          width: "60%",
          height: "70%",
          background: "radial-gradient(ellipse at center, rgba(56, 189, 248, 0.09) 0%, rgba(14, 165, 233, 0.04) 45%, transparent 70%)",
          borderRadius: "50%",
          animation: prefersReducedMotion ? undefined : "orb-drift-1 18s ease-in-out infinite",
        }}
      />

      {/* Bottom-left green accent orb */}
      <div
        style={{
          position: "absolute",
          bottom: "-14%",
          left: "-8%",
          width: "52%",
          height: "62%",
          background: "radial-gradient(ellipse at center, rgba(52, 211, 153, 0.07) 0%, rgba(16, 185, 129, 0.03) 45%, transparent 70%)",
          borderRadius: "50%",
          animation: prefersReducedMotion ? undefined : "orb-drift-2 22s ease-in-out infinite",
        }}
      />

      {/* Center aurora — subtle large mesh */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: "70%",
          height: "60%",
          background: "radial-gradient(ellipse at 50% 40%, rgba(56, 189, 248, 0.035) 0%, rgba(52, 211, 153, 0.02) 40%, transparent 70%)",
          borderRadius: "50%",
          animation: prefersReducedMotion ? undefined : "orb-drift-3 28s ease-in-out infinite",
        }}
      />

      {/* Subtle dot grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
        }}
      />

      {/* Top gradient fade — helps navbar blend */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "120px",
          background: "linear-gradient(to bottom, rgba(2, 6, 23, 0.5) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
