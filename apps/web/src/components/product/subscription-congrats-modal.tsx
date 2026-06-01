"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

export interface SubscriptionCongratsModalProps {
  planName: string;
  onClose: () => void;
}

const STEPS = [
  {
    label: "Go to Create Project",
    href: "/workflows",
    linkText: "Open Create Project",
  },
  {
    label: "Connect your GitHub App to link repositories",
    href: null,
    linkText: null,
  },
  {
    label: "Choose a project type and workflow recipe",
    href: null,
    linkText: null,
  },
  {
    label: "Generate and commit your CI/CD workflow",
    href: null,
    linkText: null,
  },
] as const;

export function SubscriptionCongratsModal({
  planName,
  onClose,
}: SubscriptionCongratsModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = "congrats-modal-heading";

  /* Focus the dialog on mount */
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    /* Store previously focused element to restore on close */
    const prevFocused = document.activeElement as HTMLElement | null;

    /* Focus first focusable element inside dialog */
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    if (first) first.focus();

    return () => {
      prevFocused?.focus();
    };
  }, []);

  /* Focus trap */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
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
  }, [onClose]);

  function handleCreateProject() {
    onClose();
    router.push("/workflows");
  }

  /* Animation variants */
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const panelVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.22,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.97,
      transition: { duration: 0.16, ease: "easeIn" as const },
    },
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="congrats-backdrop"
        variants={prefersReducedMotion ? undefined : backdropVariants}
        initial={prefersReducedMotion ? undefined : "hidden"}
        animate={prefersReducedMotion ? undefined : "visible"}
        exit={prefersReducedMotion ? undefined : "exit"}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 15, 16, 0.55)",
          zIndex: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(1rem, 4vw, 2rem)",
        }}
      >
        {/* Panel — stop propagation so clicking inside doesn't close */}
        <motion.div
          key="congrats-panel"
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
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-elevated)",
            width: "100%",
            maxWidth: 520,
            padding: "clamp(1.75rem, 4vw, 2.5rem)",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            position: "relative",
          }}
        >
          {/* Close button */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "transparent",
              border: "1px solid var(--border-subtle)",
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
              t.style.background = "var(--bg-soft)";
              t.style.borderColor = "var(--border-strong)";
              t.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget;
              t.style.background = "transparent";
              t.style.borderColor = "var(--border-subtle)";
              t.style.color = "var(--text-muted)";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Header */}
          <header style={{ display: "grid", gap: "0.5rem", paddingRight: "2rem" }}>
            {/* Kicker badge */}
            <span
              className="hero-chip"
              style={{ width: "fit-content", fontSize: "0.73rem" }}
            >
              Subscription active
            </span>

            <h2
              id={headingId}
              style={{
                fontFamily: "'Sora', var(--font-display), sans-serif",
                fontSize: "clamp(1.45rem, 3vw, 1.9rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {"You're on "}
              <span style={{ color: "var(--brand)" }}>{planName}</span>
              {"!"}
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--text-secondary)",
                fontSize: "clamp(0.875rem, 1.2vw, 0.95rem)",
                lineHeight: 1.6,
              }}
            >
              Unlimited workflow generation, template access, and GitHub App
              integration are now unlocked.
            </p>
          </header>

          {/* Steps */}
          <section aria-label="Getting started steps">
            <p
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Get started in 4 steps
            </p>

            <ol
              className="subscription-checklist"
              style={{ counterReset: "steps" }}
            >
              {STEPS.map((step, index) => (
                <li key={step.label}>
                  <span className="checklist-step" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.9rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Actions */}
          <footer
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              paddingTop: "0.25rem",
            }}
          >
            <button
              type="button"
              className="primary-button"
              onClick={handleCreateProject}
            >
              Create Your First Project
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
            >
              Got it
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
