"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import type { PendingAccount } from "@/features/auth/session";
import { useAuthCallbackViewModel } from "../view-models/use-auth-callback-view-model";
import {
  accountActionErrorMessage,
  failedContent,
  formatDate,
  type FailedContent,
} from "../model/callback-rules";

type FreshConfirmState = "idle" | "confirming";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
};

function cardMotionProps(prefersReducedMotion: boolean | null) {
  return {
    variants: prefersReducedMotion ? undefined : cardVariants,
    initial: prefersReducedMotion ? false : ("hidden" as const),
    animate: "visible" as const,
  };
}

function busyButtonStyle(busy: boolean, idleOpacity = 1) {
  return {
    cursor: busy ? ("not-allowed" as const) : ("pointer" as const),
    opacity: busy ? 0.6 : idleOpacity,
  };
}

function ArchivedChoiceIcon() {
  return (
    <div
      className="state-icon"
      aria-hidden="true"
      style={{
        background: "rgba(251, 191, 36, 0.08)",
        border: "1px solid rgba(251, 191, 36, 0.25)",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-amber)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    </div>
  );
}

function ArchivedAccountDates({
  pending,
}: Readonly<{ pending: PendingAccount & { pending: true } }>) {
  const archivedOn = pending.archivedAt ? formatDate(pending.archivedAt) : null;
  const purgeOn = pending.purgeAt ? formatDate(pending.purgeAt) : null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        textAlign: "left",
        width: "100%",
        background: "rgba(251, 191, 36, 0.04)",
        border: "1px solid rgba(251, 191, 36, 0.15)",
        borderRadius: "0.75rem",
        padding: "0.9rem 1rem",
      }}
    >
      {archivedOn ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-muted)" }}>Archived on:</span>{" "}
          <strong style={{ color: "var(--text-primary)" }}>{archivedOn}</strong>
        </p>
      ) : null}
      {purgeOn ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--danger)", fontWeight: 600 }}>Permanent deletion:</span>{" "}
          <strong style={{ color: "var(--danger)" }}>{purgeOn}</strong>
        </p>
      ) : null}
      {pending.retentionDays != null ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Archived accounts are permanently deleted after {pending.retentionDays} days. Restoring
          before that date recovers everything.
        </p>
      ) : null}
    </div>
  );
}

function RestoreAccountAction({
  isRestoring,
  isStartingFresh,
  restoreError,
  onRestore,
}: Readonly<{
  isRestoring: boolean;
  isStartingFresh: boolean;
  restoreError: string | null;
  onRestore: () => void;
}>) {
  const busy = isRestoring || isStartingFresh;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
      <button
        type="button"
        onClick={onRestore}
        disabled={busy}
        className="primary-button"
        style={{
          width: "100%",
          minHeight: "2.75rem",
          padding: "0.65rem 1.5rem",
          fontSize: "0.95rem",
          ...busyButtonStyle(busy),
        }}
        aria-busy={isRestoring}
      >
        {isRestoring ? "Restoring..." : "Restore my account"}
      </button>
      {restoreError ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: "0.8rem", color: "var(--danger)", textAlign: "center" }}
        >
          {restoreError}
        </p>
      ) : null}
    </div>
  );
}

function StartFreshIdleButton({
  prefersReducedMotion,
  disabled,
  onClick,
}: Readonly<{
  prefersReducedMotion: boolean | null;
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <motion.button
      key="start-fresh-btn"
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ghost-button"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        width: "100%",
        minHeight: "2.75rem",
        padding: "0.65rem 1.5rem",
        fontSize: "0.88rem",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      aria-expanded={false}
    >
      Start fresh with a new account
    </motion.button>
  );
}

function StartFreshConfirm({
  prefersReducedMotion,
  isStartingFresh,
  onConfirm,
  onCancel,
}: Readonly<{
  prefersReducedMotion: boolean | null;
  isStartingFresh: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return (
    <motion.div
      key="start-fresh-confirm"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        background: "rgba(248, 113, 113, 0.06)",
        border: "1px solid rgba(248, 113, 113, 0.2)",
        borderRadius: "0.75rem",
        padding: "0.85rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
      }}
      role="group"
      aria-label="Confirm start fresh"
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.82rem",
          color: "var(--danger)",
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        This permanently deletes your archived account and all its data. Your GitHub
        repositories and workflow files on GitHub are not affected.
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isStartingFresh}
          style={{
            flex: 1,
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#fff",
            padding: "0.45rem 0.85rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(248, 113, 113, 0.6)",
            background: isStartingFresh
              ? "rgba(248, 113, 113, 0.2)"
              : "rgba(248, 113, 113, 0.7)",
            cursor: isStartingFresh ? "not-allowed" : "pointer",
            opacity: isStartingFresh ? 0.6 : 1,
            transition: "all 0.2s ease",
          }}
          aria-busy={isStartingFresh}
        >
          {isStartingFresh ? "Creating account..." : "Yes, delete and start fresh"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isStartingFresh}
          style={{
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            padding: "0.45rem 0.85rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border-strong)",
            background: "transparent",
            cursor: isStartingFresh ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

function StartFreshAction({
  prefersReducedMotion,
  isRestoring,
  isStartingFresh,
  freshConfirm,
  freshError,
  onAskConfirm,
  onConfirm,
  onCancel,
}: Readonly<{
  prefersReducedMotion: boolean | null;
  isRestoring: boolean;
  isStartingFresh: boolean;
  freshConfirm: FreshConfirmState;
  freshError: string | null;
  onAskConfirm: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const disabled = isRestoring || isStartingFresh;
  return (
    <div
      style={{
        width: "100%",
        borderTop: "1px solid var(--border-soft)",
        paddingTop: "0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <AnimatePresence mode="wait">
        {freshConfirm === "idle" ? (
          <StartFreshIdleButton
            prefersReducedMotion={prefersReducedMotion}
            disabled={disabled}
            onClick={onAskConfirm}
          />
        ) : (
          <StartFreshConfirm
            prefersReducedMotion={prefersReducedMotion}
            isStartingFresh={isStartingFresh}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )}
      </AnimatePresence>
      {freshError ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: "0.8rem", color: "var(--danger)", textAlign: "center" }}
        >
          {freshError}
        </p>
      ) : null}
    </div>
  );
}

function ArchivedChoiceCard({
  pending,
  onRestore,
  onStartFresh,
}: {
  pending: PendingAccount & { pending: true };
  onRestore: () => Promise<void>;
  onStartFresh: () => Promise<void>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isStartingFresh, setIsStartingFresh] = useState(false);
  const [freshError, setFreshError] = useState<string | null>(null);
  const [freshConfirm, setFreshConfirm] = useState<FreshConfirmState>("idle");

  async function handleRestore() {
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await onRestore();
    } catch (err) {
      setRestoreError(accountActionErrorMessage(err, "restore"));
      setIsRestoring(false);
    }
  }

  async function handleStartFresh() {
    setIsStartingFresh(true);
    setFreshError(null);
    try {
      await onStartFresh();
    } catch (err) {
      setFreshError(accountActionErrorMessage(err, "start-fresh"));
      setIsStartingFresh(false);
      setFreshConfirm("idle");
    }
  }

  return (
    <motion.div
      {...cardMotionProps(prefersReducedMotion)}
      className="state-card"
      role="main"
      aria-labelledby="archived-heading"
    >
      <ArchivedChoiceIcon />
      <p className="hero-kicker" style={{ margin: 0 }}>
        Welcome back, <span style={{ fontFamily: "ui-monospace, monospace" }}>@{pending.login}</span>
      </p>
      <h1 id="archived-heading" style={{ fontSize: "clamp(1.2rem, 2.2vw, 1.45rem)" }}>
        Your account is archived
      </h1>
      <ArchivedAccountDates pending={pending} />
      <RestoreAccountAction
        isRestoring={isRestoring}
        isStartingFresh={isStartingFresh}
        restoreError={restoreError}
        onRestore={() => void handleRestore()}
      />
      <StartFreshAction
        prefersReducedMotion={prefersReducedMotion}
        isRestoring={isRestoring}
        isStartingFresh={isStartingFresh}
        freshConfirm={freshConfirm}
        freshError={freshError}
        onAskConfirm={() => setFreshConfirm("confirming")}
        onConfirm={() => void handleStartFresh()}
        onCancel={() => {
          setFreshConfirm("idle");
          setFreshError(null);
        }}
      />
    </motion.div>
  );
}

function ArchivedSessionExpiredCard({ retryHref }: { retryHref: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      {...cardMotionProps(prefersReducedMotion)}
      className="state-card"
    >
      <div
        className="state-icon"
        aria-hidden="true"
        style={{
          background: "rgba(251, 191, 36, 0.08)",
          border: "1px solid rgba(251, 191, 36, 0.25)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-amber)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1>Session expired</h1>
      <p>
        The account-choice session could not be found. Please sign in again to continue.
      </p>
      <div className="hero-actions">
        <Link className="primary-button" href={retryHref}>
          Sign in with GitHub
        </Link>
        <Link className="ghost-button" href="/">
          Return to Home
        </Link>
      </div>
    </motion.div>
  );
}

function AuthFailedActions({
  fc,
  retryLoginHref,
  providerName,
}: Readonly<{
  fc: FailedContent;
  retryLoginHref: string;
  providerName: string;
}>) {
  return (
    <div
      style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginTop: "0.4rem" }}
    >
      {fc.actionHref ? (
        <a
          className="primary-button"
          href={fc.actionHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ borderRadius: "999px", padding: "0.9rem 1.9rem", fontWeight: 700 }}
        >
          {fc.actionLabel}
        </a>
      ) : null}
      <Link
        className={fc.actionHref ? "ghost-button" : "primary-button"}
        href={retryLoginHref}
        style={{ borderRadius: "999px", padding: "0.9rem 1.9rem", fontWeight: fc.actionHref ? 600 : 700 }}
      >
        Retry {providerName} sign in
      </Link>
      <Link
        className="ghost-button"
        href="/"
        style={{ borderRadius: "999px", padding: "0.9rem 1.75rem", fontWeight: 600 }}
      >
        Return to sign-in
      </Link>
    </div>
  );
}

function AuthFailedGate({
  prefersReducedMotion,
  authStatus,
  message,
  orgLogin,
  intent,
  providerName,
  retryLoginHref,
}: Readonly<{
  prefersReducedMotion: boolean | null;
  authStatus: string;
  message: string;
  orgLogin: string | null;
  intent: string;
  providerName: string;
  retryLoginHref: string;
}>) {
  const fc = failedContent(authStatus, message, orgLogin);
  const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
  };
  const rise = {
    hidden: { opacity: 0, y: 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
    },
  };
  const itemVariants = prefersReducedMotion ? undefined : rise;

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        background: "var(--bg-base)",
      }}
    >
      <FlowBackground />
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none" }}>
        {[
          { top: "1.5rem", left: "1.5rem" },
          { top: "1.5rem", right: "1.5rem" },
          { bottom: "1.5rem", left: "1.5rem" },
          { bottom: "1.5rem", right: "1.5rem" },
        ].map((pos, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              ...pos,
              color: "rgba(255,255,255,0.14)",
              fontSize: "0.9rem",
              fontFamily: "ui-monospace, monospace",
              lineHeight: 1,
            }}
          >
            +
          </span>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="auth-gate-ghost"
        style={{
          position: "absolute",
          right: "clamp(-3rem, -3vw, -1rem)",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "clamp(6rem, 27vw, 26rem)",
          fontWeight: 800,
          letterSpacing: "-0.06em",
          lineHeight: 0.8,
          color: fc.accent,
          opacity: 0.08,
          whiteSpace: "nowrap",
          userSelect: "none",
          zIndex: 1,
        }}
      >
        {fc.ghost}
      </span>
      <motion.div
        initial={prefersReducedMotion ? false : "hidden"}
        animate="visible"
        variants={prefersReducedMotion ? undefined : staggerContainer}
        style={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          maxWidth: "760px",
          padding: "0 clamp(1.75rem, 7vw, 7rem)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "1.4rem",
        }}
      >
        <motion.p variants={itemVariants} className="file-path-label" style={{ margin: 0 }}>
          auth / access-gate
        </motion.p>
        <motion.div
          variants={itemVariants}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.55rem",
            padding: "0.35rem 0.9rem",
            borderRadius: "999px",
            background: fc.accentSoft,
            border: `1px solid ${fc.accent}`,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: fc.accent,
              boxShadow: `0 0 8px ${fc.accent}`,
              animation: prefersReducedMotion ? undefined : "flow-pulse 1.8s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: fc.accent,
            }}
          >
            {fc.label}
          </span>
        </motion.div>
        <motion.h1
          variants={itemVariants}
          style={{
            margin: 0,
            fontSize: "clamp(2.25rem, 5.5vw, 4.5rem)",
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            maxWidth: "18ch",
          }}
        >
          {fc.headline}
        </motion.h1>
        <motion.p
          variants={itemVariants}
          style={{
            margin: 0,
            fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            maxWidth: "540px",
          }}
        >
          {fc.body}
        </motion.p>
        <motion.div variants={itemVariants}>
          <AuthFailedActions fc={fc} retryLoginHref={retryLoginHref} providerName={providerName} />
        </motion.div>
        <motion.div
          variants={itemVariants}
          style={{
            marginTop: "1.6rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border-subtle)",
            width: "100%",
            maxWidth: "540px",
            display: "flex",
            gap: "1.75rem",
            flexWrap: "wrap",
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
          }}
        >
          <span>Provider · {providerName}</span>
          <span>Intent · {intent === "signup" ? "Sign up" : "Login"}</span>
          <span>Gate · GitHub org</span>
        </motion.div>
      </motion.div>
    </main>
  );
}

function ArchivedChoiceScreen({
  pendingSessionExpired,
  pendingAccount,
  retryLoginHref,
  onRestore,
  onStartFresh,
}: Readonly<{
  pendingSessionExpired: boolean;
  pendingAccount: PendingAccount | null;
  retryLoginHref: string;
  onRestore: () => Promise<void>;
  onStartFresh: () => Promise<void>;
}>) {
  const expired = pendingSessionExpired || pendingAccount === null;
  return (
    <main className="dash-shell">
      <FlowBackground />
      <div className="state-body">
        {expired ? (
          <ArchivedSessionExpiredCard retryHref={retryLoginHref} />
        ) : (
          <ArchivedChoiceCard
            pending={pendingAccount as PendingAccount & { pending: true }}
            onRestore={onRestore}
            onStartFresh={onStartFresh}
          />
        )}
      </div>
    </main>
  );
}

export function AuthCallbackView() {
  const prefersReducedMotion = useReducedMotion();
  const {
    state,
    message,
    authStatus,
    intent,
    providerName,
    orgLogin,
    pendingAccount,
    pendingSessionExpired,
    retryLoginHref,
    onRestore,
    onStartFresh,
  } = useAuthCallbackViewModel();

  if (state === "checking") {
    return <PipelineLoader label={message} />;
  }
  if (state === "archived_choice") {
    return (
      <ArchivedChoiceScreen
        pendingSessionExpired={pendingSessionExpired}
        pendingAccount={pendingAccount}
        retryLoginHref={retryLoginHref}
        onRestore={onRestore}
        onStartFresh={onStartFresh}
      />
    );
  }

  return (
    <AuthFailedGate
      prefersReducedMotion={prefersReducedMotion}
      authStatus={authStatus}
      message={message}
      orgLogin={orgLogin}
      intent={intent}
      providerName={providerName}
      retryLoginHref={retryLoginHref}
    />
  );
}
