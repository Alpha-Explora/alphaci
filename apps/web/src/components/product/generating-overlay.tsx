"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface GeneratingOverlayProps {
  isVisible: boolean;
}

/** Animated ellipsis that cycles . → .. → ... */
function AnimatedDots() {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{ display: "inline-block", minWidth: "1.5rem", textAlign: "left" }}>
      {".".repeat(dots)}
    </span>
  );
}

/** Dual concentric rings at different rotation speeds */
function PremiumSpinner() {
  return (
    <div
      style={{
        position: "relative",
        width: "72px",
        height: "72px",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {/* Outer ring — slow */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "2px solid transparent",
          borderTopColor: "rgba(56, 189, 248, 0.9)",
          borderRightColor: "rgba(56, 189, 248, 0.3)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
      />

      {/* Inner ring — fast, counter-clockwise */}
      <motion.div
        style={{
          position: "absolute",
          inset: "12px",
          borderRadius: "50%",
          border: "2px solid transparent",
          borderTopColor: "rgba(56, 189, 248, 0.6)",
          borderBottomColor: "rgba(56, 189, 248, 0.2)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
      />

      {/* Center dot pulse */}
      <motion.div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          marginTop: "-4px",
          marginLeft: "-4px",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "rgba(56, 189, 248, 0.85)",
          boxShadow: "0 0 12px rgba(56, 189, 248, 0.6)",
        }}
        animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  );
}

export function GeneratingOverlay({ isVisible }: GeneratingOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="generating-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(2, 6, 23, 0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {/* Floating card */}
          <motion.div
            role="status"
            aria-label="Generating repository, please wait"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
              maxWidth: "400px",
              width: "calc(100% - 3rem)",
              padding: "2.5rem 2rem",
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "1.25rem",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.05)",
            }}
            initial={{ scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.9 }}
          >
            <PremiumSpinner />

            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  margin: "0 0 0.45rem",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  color: "var(--text-primary, #f1f5f9)",
                  letterSpacing: "-0.01em",
                }}
              >
                Generating repository<AnimatedDots />
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "var(--text-muted, rgba(148, 163, 184, 0.75))",
                  lineHeight: 1.55,
                }}
              >
                Setting up branches, committing workflow
              </p>
            </div>

            {/* Subtle ambient glow bar at bottom */}
            <div
              style={{
                width: "100%",
                height: "3px",
                borderRadius: "2px",
                background: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.6), transparent)",
                backgroundSize: "200% 100%",
                animation: "glowSweep 1.8s linear infinite",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
