"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface HelpTipProps {
  /** The explanatory text announced to screen readers and shown in the popover. */
  text: string;
  /** Accessible label for the trigger button. Defaults to a generic "More information". */
  label?: string;
  className?: string;
}

/**
 * Accessible inline contextual-help trigger.
 *
 * Unlike a native `title=` attribute (no keyboard or screen-reader support),
 * this is a real, focusable button: it opens on hover OR focus, closes on
 * Escape/blur/mouseleave, and the popover text is linked via `aria-describedby`
 * so assistive tech announces it as soon as the trigger receives focus —
 * no activation required to *read* it, matching native tooltip semantics.
 */
export function HelpTip({ text, label = "More information", className }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const tooltipId = useId();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      hide();
    }
  }

  return (
    <span className={["help-tip", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="help-tip__trigger"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={label}
        onFocus={show}
        onBlur={hide}
        onMouseEnter={show}
        onMouseLeave={hide}
        onKeyDown={handleKeyDown}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
          <line x1="12" y1="17" x2="12" y2="17.01" />
        </svg>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.span
            role="tooltip"
            id={tooltipId}
            className="help-tip__bubble"
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: 2 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {text}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
