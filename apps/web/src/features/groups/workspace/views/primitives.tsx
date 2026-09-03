"use client";

import "./hierarchy.css";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { ResourceState } from "@/features/groups";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/* ── Breadcrumb ───────────────────────────────────────────────────────────── */

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <p className="hier-breadcrumb">
        {items.map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            {index > 0 && (
              <span className="hier-breadcrumb-sep" aria-hidden="true">
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </span>
        ))}
      </p>
    </nav>
  );
}

/* ── Page header ──────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="hier-header"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      <div className="hier-header-titles">
        <h1 className="hier-title">{title}</h1>
        {subtitle && <p className="hier-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="hier-header-actions">{actions}</div>}
    </motion.div>
  );
}

/* ── Section header ───────────────────────────────────────────────────────── */

export function SectionHeader({
  title,
  count,
  actions,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="hier-section-head">
      <div className="hier-section-head-left">
        <h2 className="hier-section-title">{title}</h2>
        {typeof count === "number" && (
          <span className="hier-count-chip">{count}</span>
        )}
      </div>
      {actions && <div className="hier-header-actions">{actions}</div>}
    </div>
  );
}

/* ── Group sub-navigation ─────────────────────────────────────────────────── */

export function GroupSubNav({
  groupId,
  active,
}: {
  groupId: string;
  active: "overview" | "members" | "systems" | "activity";
}) {
  const tabs: { key: typeof active; label: string; href: string }[] = [
    { key: "overview", label: "Overview", href: `/groups/${groupId}` },
    { key: "members", label: "Members", href: `/groups/${groupId}/members` },
    { key: "systems", label: "Projects", href: `/groups/${groupId}/systems` },
    { key: "activity", label: "Activity", href: `/groups/${groupId}/activity` },
  ];
  return (
    <nav className="hier-subnav" aria-label="Group sections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className="hier-subnav-link"
          aria-current={tab.key === active ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/* ── State views ──────────────────────────────────────────────────────────── */

function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const STATE_DEFAULTS = {
  empty: { title: "Nothing here yet", message: "There's nothing to show in this view right now." },
  forbidden: { title: "You don't have access", message: "Your role in this group doesn't allow you to view this. Ask a group lead if you need access." },
  notfound: { title: "Not found", message: "This item doesn't exist, or you don't have access to it." },
  error: { title: "Something went wrong", message: "We couldn't load this view. Please try again." },
} as const;

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="hier-skeleton" style={{ height: "4.5rem" }} />
      ))}
    </div>
  );
}

export function StateView({
  variant,
  title,
  message,
  action,
  onRetry,
}: {
  variant: Exclude<ResourceState, "ready" | "loading">;
  title?: string;
  message?: string;
  action?: ReactNode;
  onRetry?: () => void;
}) {
  const defaults = STATE_DEFAULTS[variant];
  const conf = { title: title ?? defaults.title, message: message ?? defaults.message };
  const useLock = variant === "forbidden";
  const danger = variant === "error";

  return (
    <div className="hier-state" role={variant === "error" ? "alert" : undefined}>
      <span
        className={`hier-state-icon${danger ? " hier-state-icon--danger" : ""}`}
        aria-hidden="true"
      >
        {useLock ? <LockIcon /> : <InfoIcon />}
      </span>
      <h2 className="hier-state-title">{conf.title}</h2>
      <p className="hier-state-text">{conf.message}</p>
      {onRetry && variant === "error" && (
        <button className="ghost-button" type="button" onClick={onRetry} style={{ marginTop: "0.4rem" }}>
          Try again
        </button>
      )}
      {action}
    </div>
  );
}

/**
 * Renders the correct StateView for a non-ready resource state, or `null` when
 * ready. Centralizes the loading/empty/forbidden/notfound/error branching so
 * every page handles all five states identically.
 */
export function ResourceBoundary({
  state,
  onRetry,
  loading,
  emptyTitle,
  emptyMessage,
  emptyAction,
  notFoundTitle,
  notFoundMessage,
  forbiddenMessage,
}: {
  state: ResourceState;
  onRetry?: () => void;
  loading?: ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  notFoundTitle?: string;
  notFoundMessage?: string;
  forbiddenMessage?: string;
}) {
  if (state === "loading") return <>{loading ?? <LoadingRows />}</>;
  if (state === "empty")
    return (
      <StateView variant="empty" title={emptyTitle} message={emptyMessage} action={emptyAction} />
    );
  if (state === "forbidden")
    return <StateView variant="forbidden" message={forbiddenMessage} />;
  if (state === "notfound")
    return <StateView variant="notfound" title={notFoundTitle} message={notFoundMessage} />;
  if (state === "error") return <StateView variant="error" onRetry={onRetry} />;
  return null;
}

/* ── Dialog ───────────────────────────────────────────────────────────────── */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input, select, textarea, button",
      );
      focusable?.focus();
    }, 0);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="hier-dialog-backdrop"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            className="hier-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <h2 className="hier-dialog-title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="hier-dialog-desc" id={descId}>
                {description}
              </p>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Dialog + form scaffolding shared by every create/invite/assign dialog:
 * submit + cancel actions, inline error, and a busy state.
 */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  submitting,
  error,
  canSubmit = true,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  canSubmit?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!submitting && canSubmit) onSubmit();
  }
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form onSubmit={handleSubmit} noValidate>
        {children}
        {error && (
          <p className="error-text" role="alert" style={{ margin: "0.4rem 0 0", fontSize: "0.8rem" }}>
            {error}
          </p>
        )}
        <div className="hier-dialog-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={submitting || !canSubmit}
          >
            {submitting ? "Working…" : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────────────── */

export function Avatar({
  login,
  name,
  avatarUrl,
}: {
  login?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const initial = (name ?? login ?? "U").slice(0, 1).toUpperCase();
  return (
    <span className="hier-avatar" aria-hidden="true">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" />
      ) : (
        initial
      )}
    </span>
  );
}
