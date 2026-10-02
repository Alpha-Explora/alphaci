"use client";

import "./hierarchy.css";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

function dialogClasses(size: "default" | "wide"): { backdrop: string; panel: string } {
  return size === "wide"
    ? { backdrop: "hier-dialog-backdrop hier-dialog-backdrop--wide", panel: "hier-dialog hier-dialog--wide" }
    : { backdrop: "hier-dialog-backdrop", panel: "hier-dialog" };
}

const noSubscription = () => () => undefined;

/** False on the server and while hydrating, true once mounted in a browser. */
function useIsClient(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/**
 * Where a dialog renders. A wide sheet goes to <body>: inside a page panel
 * whose backdrop-filter or transform makes it the containing block, a
 * "fixed" sheet would centre on that panel and slide under the app header
 * at small heights. The default card stays where it always was.
 */
function DialogLayer({ portal, children }: { portal: boolean; children: ReactNode }) {
  const client = useIsClient();
  return portal && client ? createPortal(children, document.body) : <>{children}</>;
}

function describedById(describedBy: string | undefined, description: string | undefined, descId: string) {
  if (describedBy) return describedBy;
  return description ? descId : undefined;
}

/**
 * "default": the 440px card every create/invite/assign dialog uses.
 * "wide": a landscape sheet, min(1100px, 94vw), whose header and footer stay
 * pinned while only the body scrolls (a full-screen sheet on phones).
 */
export type DialogSize = "default" | "wide";

export function Dialog({
  open,
  onClose,
  title,
  description,
  describedBy,
  size = "default",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /**
   * The id of a description the caller renders itself (inside a scrolling
   * body, say). Takes the place of `description` for aria-describedby.
   */
  describedBy?: string;
  size?: DialogSize;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const classes = dialogClasses(size);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  /* The latest onClose for Escape. Callers often pass a new function every
   * render; if the effect below depended on it, each re-render (a keystroke)
   * would re-run it and pull focus back to the first field. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /* Focus the first field on open and restore focus on close: once per
   * opening, never on a re-render while open. */
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
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  return (
    <DialogLayer portal={size === "wide"}>
    <AnimatePresence>
      {open && (
        <motion.div
          className={classes.backdrop}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            className={classes.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={describedById(describedBy, description, descId)}
            /* Opacity and a short lift only, both compositor-friendly: no
               scale, which re-rasterised the panel and its large shadow. */
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
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
    </DialogLayer>
  );
}

function FormDialogFooter({
  error,
  submitLabel,
  submitting,
  canSubmit,
  onClose,
}: {
  error?: string | null;
  submitLabel: string;
  submitting: boolean;
  canSubmit: boolean;
  onClose: () => void;
}) {
  return (
    <>
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
    </>
  );
}

/**
 * Dialog + form scaffolding shared by every create/invite/assign dialog:
 * submit + cancel actions, inline error, and a busy state. `size="wide"`
 * pins the title and the actions and scrolls only the body between them, so
 * Cancel and Create are never cut off, however short the window.
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
  size = "default",
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
  size?: DialogSize;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const bodyDescId = useId();
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!submitting && canSubmit) onSubmit();
  }
  const footer = (
    <FormDialogFooter
      error={error}
      submitLabel={submitLabel}
      submitting={submitting}
      canSubmit={canSubmit}
      onClose={onClose}
    />
  );
  if (size !== "wide") {
    return (
      <Dialog open={open} onClose={onClose} title={title} description={description}>
        <form onSubmit={handleSubmit} noValidate>
          {children}
          {footer}
        </form>
      </Dialog>
    );
  }
  // Wide: the description scrolls with the body, so at small heights only
  // the title and the actions hold their room.
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      describedBy={description ? bodyDescId : undefined}
      size="wide"
    >
      <form className="hier-dialog-form" onSubmit={handleSubmit} noValidate>
        <div className="hier-dialog-body">
          {description && (
            <p className="hier-dialog-desc" id={bodyDescId}>
              {description}
            </p>
          )}
          {children}
        </div>
        <div className="hier-dialog-footer">{footer}</div>
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
