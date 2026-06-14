"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

export interface WelcomeModalProps {
  displayName: string;
  onDismiss: () => void;
}

const FLOW_STEPS = [
  { label: "Connect GitHub", detail: "Install the GitHub App to grant FlowCI access to your account." },
  { label: "Create a project", detail: "Choose a repo shape, stack, and CI recipe in the Setup form." },
  { label: "We provision everything", detail: "FlowCI creates the repo, branches, and commits the workflow file." },
  { label: "Push and ship", detail: "Open a pull request and your CI pipeline runs automatically." },
] as const;

const EASE_SPRING: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function WelcomeModal({ displayName, onDismiss }: WelcomeModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = "welcome-modal-heading";
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /* Store previous focus, focus dialog on mount */
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const el = dialogRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  /* Focus trap + Esc handler */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }

      if (e.key !== "Tab") return;

      const el = dialogRef.current;
      if (!el) return;

      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  function handleTakeTour() {
    onDismiss();
    router.push("/workflows?tour=1");
  }

  function handleOpenGuide() {
    onDismiss();
    router.push("/guide");
  }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const panelVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 8 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.28, ease: EASE_SPRING },
    },
    exit: {
      opacity: 0,
      scale: 0.97,
      y: 4,
      transition: { duration: 0.18, ease: "easeIn" as const },
    },
  };

  const stepListVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06, delayChildren: prefersReducedMotion ? 0 : 0.18 } },
  };

  const stepItemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.25, 0, 0, 1] as [number, number, number, number] } },
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="welcome-backdrop"
        variants={prefersReducedMotion ? undefined : backdropVariants}
        initial={prefersReducedMotion ? undefined : "hidden"}
        animate={prefersReducedMotion ? undefined : "visible"}
        exit={prefersReducedMotion ? undefined : "exit"}
        transition={{ duration: 0.2 }}
        onClick={onDismiss}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 6, 23, 0.72)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(1rem, 4vw, 2rem)",
        }}
      >
        {/* Panel */}
        <motion.div
          key="welcome-panel"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          variants={prefersReducedMotion ? undefined : panelVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "visible"}
          exit={prefersReducedMotion ? undefined : "exit"}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            background: "rgba(15, 23, 42, 0.97)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-card)",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.08)",
            width: "100%",
            maxWidth: 520,
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            overflow: "hidden",
          }}
        >
          {/* Top accent bar — brand gradient */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background: "linear-gradient(90deg, var(--brand), var(--accent-violet))",
            }}
          />

          {/* Inner padding wrapper */}
          <div style={{ padding: "clamp(1.75rem, 4vw, 2.25rem)", paddingTop: "calc(clamp(1.75rem, 4vw, 2.25rem) + 2px)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Close button */}
            <button
              type="button"
              aria-label="Close welcome dialog"
              onClick={onDismiss}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "transparent",
                border: "1px solid var(--border-soft)",
                borderRadius: "0.5rem",
                width: "2rem",
                height: "2rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
                transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget;
                t.style.background = "rgba(255,255,255,0.06)";
                t.style.borderColor = "var(--border-strong)";
                t.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget;
                t.style.background = "transparent";
                t.style.borderColor = "var(--border-soft)";
                t.style.color = "var(--text-muted)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header */}
            <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingRight: "2.5rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--brand)",
                  width: "fit-content",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--brand)",
                    boxShadow: "0 0 6px rgba(56, 189, 248, 0.7)",
                  }}
                />
                New here
              </span>

              <h2
                id={headingId}
                style={{
                  fontFamily: "var(--font-dash-display, inherit)",
                  fontSize: "clamp(1.45rem, 3vw, 1.85rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: 1.15,
                }}
              >
                {"Welcome to "}
                <span style={{ color: "var(--brand)" }}>FlowCI Studio</span>
                {", "}
                <span style={{ color: "var(--text-primary)" }}>@{displayName}</span>
              </h2>

              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(0.875rem, 1.2vw, 0.93rem)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                From a blank slate to a GitHub repository with CI/CD in one step. Here is how it works:
              </p>
            </header>

            {/* Flow steps */}
            <motion.ol
              aria-label="How FlowCI Studio works"
              variants={prefersReducedMotion ? undefined : stepListVariants}
              initial={prefersReducedMotion ? "visible" : "hidden"}
              animate="visible"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              {FLOW_STEPS.map((step, index) => (
                <motion.li
                  key={step.label}
                  variants={prefersReducedMotion ? undefined : stepItemVariants}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.65rem 0.8rem",
                    background: "rgba(56, 189, 248, 0.04)",
                    border: "1px solid rgba(56, 189, 248, 0.1)",
                    borderRadius: "0.6rem",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "1.5rem",
                      height: "1.5rem",
                      borderRadius: "50%",
                      background: "rgba(56, 189, 248, 0.12)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: "var(--brand)",
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {step.label}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                      {step.detail}
                    </span>
                  </div>
                </motion.li>
              ))}
            </motion.ol>

            {/* Action buttons */}
            <footer style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleTakeTour}
                style={{ fontSize: "0.85rem" }}
              >
                Take the guided tour
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleOpenGuide}
                style={{ fontSize: "0.85rem" }}
              >
                Explore the guide
              </button>
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "0.45rem",
                  transition: "color 0.15s ease, background 0.15s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Skip for now
              </button>
            </footer>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
