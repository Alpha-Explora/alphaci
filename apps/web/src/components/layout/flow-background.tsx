"use client";
import { useReducedMotion } from "framer-motion";

/* FlowBackground — Aurora orbs animated via pure CSS keyframes.
   CSS animations run on the compositor thread — no JS frame budget consumed. */
export function FlowBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {!reduced ? (
        <>
          {/* Orb 1 — blue, top-right */}
          <div style={{
            position: "absolute",
            width: "72vw",
            height: "72vw",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, #3b82f6 0%, #1d4ed8 40%, transparent 70%)",
            filter: "blur(52px)",
            opacity: 0.22,
            top: "-22%",
            right: "-18%",
            animation: "orb-drift-a 20s ease-in-out infinite",
          }} />

          {/* Orb 2 — violet, top-left */}
          <div style={{
            position: "absolute",
            width: "64vw",
            height: "64vw",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, #8b5cf6 0%, #6d28d9 45%, transparent 70%)",
            filter: "blur(52px)",
            opacity: 0.2,
            top: "-12%",
            left: "-22%",
            animation: "orb-drift-b 26s ease-in-out infinite",
          }} />

          {/* Orb 3 — cyan, bottom-center-left */}
          <div style={{
            position: "absolute",
            width: "58vw",
            height: "58vw",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, #06b6d4 0%, #0284c7 45%, transparent 70%)",
            filter: "blur(52px)",
            opacity: 0.18,
            bottom: "-18%",
            left: "22%",
            animation: "orb-drift-c 30s ease-in-out infinite",
          }} />

          {/* Orb 4 — emerald, bottom-right */}
          <div style={{
            position: "absolute",
            width: "52vw",
            height: "52vw",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, #10b981 0%, #059669 45%, transparent 70%)",
            filter: "blur(48px)",
            opacity: 0.16,
            bottom: "-12%",
            right: "-12%",
            animation: "orb-drift-d 24s ease-in-out infinite",
          }} />

          {/* Orb 5 — deep indigo, center-bottom anchor */}
          <div style={{
            position: "absolute",
            width: "50vw",
            height: "50vw",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, #4f46e5 0%, #3730a3 50%, transparent 70%)",
            filter: "blur(52px)",
            opacity: 0.14,
            bottom: "5%",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "orb-pulse-e 18s ease-in-out infinite",
          }} />
        </>
      ) : (
        /* Static aurora gradient — shown when reduced motion is preferred */
        <div style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 75% -10%, rgba(59,130,246,0.18) 0%, transparent 60%)," +
            "radial-gradient(ellipse 50% 40% at 20% 0%, rgba(139,92,246,0.15) 0%, transparent 60%)," +
            "radial-gradient(ellipse 40% 35% at 50% 90%, rgba(79,70,229,0.12) 0%, transparent 60%)",
        }} />
      )}
    </div>
  );
}
