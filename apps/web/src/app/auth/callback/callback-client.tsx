"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import {
  ApiError,
  createGitHubLoginUrl,
  getAuthSession,
  getPendingAccount,
  restoreAccount,
  startFreshAccount,
} from "@/lib/api/client";
import type { PendingAccountResponse } from "@/lib/api/contracts";
import { getAuthenticatedRedirectPath } from "@/lib/auth/subscription";

type CallbackState = "checking" | "failed" | "archived_choice";
type OAuthProvider = "github" | "google";
type FreshConfirmState = "idle" | "confirming";

function toSafeNextPath(raw: string | null): string {
  if (!raw) {
    return "/home";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  return "/home";
}

function toSafeProvider(raw: string | null): OAuthProvider {
  return raw === "google" ? "google" : "github";
}

function providerDisplayName(provider: OAuthProvider): "GitHub" | "Google" {
  return provider === "google" ? "Google" : "GitHub";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusMessage(authStatus: string, provider: OAuthProvider): string {
  const providerName = providerDisplayName(provider);

  switch (authStatus) {
    case "success":
      return `${providerName} sign in complete. Finalizing your session...`;
    case "failed":
      return `${providerName} sign in failed. Please retry.`;
    case "invalid_state":
      return "The OAuth state token was invalid. Please retry sign in.";
    case "unavailable":
      return `${providerName} OAuth is unavailable in this environment.`;
    case "not_authorized":
      return "This workspace is limited to members of the company GitHub organization. Ask an administrator to add you to the org, then sign in again.";
    case "org_invite_pending":
      return "You have a pending invitation to the company GitHub organization. Accept the invitation on GitHub, then sign in again.";
    case "org_verification_failed":
      // Distinct from not_authorized: this is NOT a confirmed non-member —
      // GitHub could not confirm org membership (e.g. a permissions issue on
      // our side), so telling the user to "ask to be added" would be wrong.
      return "We could not verify your GitHub organization membership right now. Please retry sign-in in a moment. If this keeps happening, contact an administrator.";
    case "archived_choice":
      return "Checking archived account...";
    default:
      return "Finalizing sign in...";
  }
}

/* ── Failure screen content (reason-aware) ──────────────────────────────────
 * The auth callback can fail for meaningfully different reasons. Each gets its
 * own headline, ghost word, and accent so the full-canvas screen reads as a
 * deliberate state, not a generic error. */
interface FailedContent {
  ghost: string;
  label: string;
  accent: string;
  accentSoft: string;
  headline: string;
  body: string;
  /** Optional external call-to-action rendered as the primary button. */
  actionHref?: string;
  actionLabel?: string;
}

/** Org logins are alphanumerics and hyphens; anything else is dropped so a
 * tampered ?org= query param can never steer the invitation link. */
function safeOrgLogin(org: string | null): string | null {
  return org && /^[a-zA-Z0-9-]+$/.test(org) ? org : null;
}

function failedContent(
  authStatus: string,
  message: string,
  orgLogin: string | null,
): FailedContent {
  switch (authStatus) {
    case "not_authorized":
      return {
        ghost: "ACCESS",
        label: "Access restricted",
        accent: "var(--accent-amber)",
        accentSoft: "rgba(251, 191, 36, 0.12)",
        headline: "This workspace is members-only",
        body: "Access is limited to members of the company GitHub organization. Ask an administrator to add you to the org, then sign in again.",
      };
    case "org_invite_pending": {
      const org = safeOrgLogin(orgLogin);
      return {
        ghost: "INVITE",
        label: "Invitation pending",
        accent: "var(--accent-amber)",
        accentSoft: "rgba(251, 191, 36, 0.12)",
        headline: "Accept your GitHub invitation",
        body: "You've been invited to the company GitHub organization, but the invitation hasn't been accepted yet. Open it on GitHub, accept it, then sign in again.",
        actionHref: org
          ? `https://github.com/orgs/${org}/invitation`
          : "https://github.com/settings/organizations",
        actionLabel: "Open GitHub invitation",
      };
    }
    case "org_verification_failed":
      return {
        ghost: "VERIFY",
        label: "Verification failed",
        accent: "var(--accent-amber)",
        accentSoft: "rgba(251, 191, 36, 0.12)",
        headline: "We couldn't verify your membership",
        body: "GitHub didn't confirm your organization membership just now. Retry in a moment — if this keeps happening, contact an administrator.",
      };
    default:
      return {
        ghost: "RETRY",
        label: "Sign-in interrupted",
        accent: "var(--brand)",
        accentSoft: "rgba(88, 166, 255, 0.12)",
        headline: "Authentication needs a retry",
        body: message,
      };
  }
}

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

/* ── Archived-choice card ─────────────────────────────────────────────────── */

function ArchivedChoiceCard({
  pending,
  nextPath,
}: {
  pending: PendingAccountResponse & { pending: true };
  nextPath: string;
}) {
  const router = useRouter();
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
      await restoreAccount();
      router.replace(nextPath);
    } catch (err) {
      setRestoreError(
        err instanceof ApiError
          ? `Restore failed (${err.status}). Please try again.`
          : "Restore failed. Please try again.",
      );
      setIsRestoring(false);
    }
  }

  async function handleStartFresh() {
    setIsStartingFresh(true);
    setFreshError(null);
    try {
      await startFreshAccount();
      router.replace(nextPath);
    } catch (err) {
      setFreshError(
        err instanceof ApiError
          ? `Could not start fresh (${err.status}). Please try again.`
          : "Could not start fresh. Please try again.",
      );
      setIsStartingFresh(false);
      setFreshConfirm("idle");
    }
  }

  const archivedOn = pending.archivedAt ? formatDate(pending.archivedAt) : null;
  const purgeOn = pending.purgeAt ? formatDate(pending.purgeAt) : null;

  return (
    <motion.div
      variants={prefersReducedMotion ? undefined : cardVariants}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      className="state-card"
      role="main"
      aria-labelledby="archived-heading"
    >
      {/* Icon — amber archive indicator */}
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

      <p className="hero-kicker" style={{ margin: 0 }}>
        Welcome back, <span style={{ fontFamily: "ui-monospace, monospace" }}>@{pending.login}</span>
      </p>

      <h1 id="archived-heading" style={{ fontSize: "clamp(1.2rem, 2.2vw, 1.45rem)" }}>
        Your account is archived
      </h1>

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
        {archivedOn && (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-muted)" }}>Archived on:</span>{" "}
            <strong style={{ color: "var(--text-primary)" }}>{archivedOn}</strong>
          </p>
        )}
        {purgeOn && (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>Permanent deletion:</span>{" "}
            <strong style={{ color: "var(--danger)" }}>{purgeOn}</strong>
          </p>
        )}
        {pending.retentionDays != null && (
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Archived accounts are permanently deleted after {pending.retentionDays} days. Restoring
            before that date recovers everything.
          </p>
        )}
      </div>

      {/* Primary action — restore */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
        <button
          type="button"
          onClick={() => void handleRestore()}
          disabled={isRestoring || isStartingFresh}
          className="primary-button"
          style={{
            width: "100%",
            minHeight: "2.75rem",
            padding: "0.65rem 1.5rem",
            fontSize: "0.95rem",
            cursor: isRestoring || isStartingFresh ? "not-allowed" : "pointer",
            opacity: isRestoring || isStartingFresh ? 0.6 : 1,
          }}
          aria-busy={isRestoring}
        >
          {isRestoring ? "Restoring..." : "Restore my account"}
        </button>

        {restoreError && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: "0.8rem", color: "var(--danger)", textAlign: "center" }}
          >
            {restoreError}
          </p>
        )}
      </div>

      {/* Destructive action — start fresh */}
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
            <motion.button
              key="start-fresh-btn"
              type="button"
              onClick={() => setFreshConfirm("confirming")}
              disabled={isRestoring || isStartingFresh}
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
                cursor: isRestoring || isStartingFresh ? "not-allowed" : "pointer",
                opacity: isRestoring || isStartingFresh ? 0.5 : 1,
              }}
              aria-expanded={false}
            >
              Start fresh with a new account
            </motion.button>
          ) : (
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
                  onClick={() => void handleStartFresh()}
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
                  onClick={() => {
                    setFreshConfirm("idle");
                    setFreshError(null);
                  }}
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
          )}
        </AnimatePresence>

        {freshError && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: "0.8rem", color: "var(--danger)", textAlign: "center" }}
          >
            {freshError}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ── Archived-choice no-pending fallback ─────────────────────────────────── */

function ArchivedSessionExpiredCard({ retryHref }: { retryHref: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      variants={prefersReducedMotion ? undefined : cardVariants}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
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

/* ── Main callback component ─────────────────────────────────────────────── */

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authStatus = searchParams.get("auth") ?? "success";
  const intent = searchParams.get("intent") === "signup" ? "signup" : "login";
  const nextPath = toSafeNextPath(searchParams.get("next"));
  const provider = toSafeProvider(searchParams.get("provider"));
  const providerName = providerDisplayName(provider);
  const prefersReducedMotion = useReducedMotion();

  const [state, setState] = useState<CallbackState>("checking");
  const [message, setMessage] = useState<string>(statusMessage(authStatus, provider));
  const [pendingAccount, setPendingAccount] = useState<PendingAccountResponse | null>(null);

  // Track whether the pending-account fetch came back with pending:false
  const [pendingSessionExpired, setPendingSessionExpired] = useState(false);

  const retryLoginHref = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent,
      next: nextPath,
      provider,
    });

    const returnTo = `/auth/callback?${callbackPath.toString()}`;
    return createGitHubLoginUrl(returnTo);
  }, [intent, nextPath, provider]);

  useEffect(() => {
    setMessage(statusMessage(authStatus, provider));
  }, [authStatus, provider]);

  // Ref guards so async callbacks don't update state after unmount
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (
      authStatus === "failed" ||
      authStatus === "invalid_state" ||
      authStatus === "unavailable" ||
      authStatus === "not_authorized" ||
      authStatus === "org_verification_failed"
    ) {
      setState("failed");
      return;
    }

    if (authStatus === "archived_choice") {
      async function loadPending() {
        try {
          const data = await getPendingAccount();
          if (disposedRef.current) return;

          if (!data.pending) {
            setPendingSessionExpired(true);
          } else {
            setPendingAccount(data);
          }
          setState("archived_choice");
        } catch {
          if (disposedRef.current) return;
          // Treat a fetch failure the same as an expired pending session
          setPendingSessionExpired(true);
          setState("archived_choice");
        }
      }
      void loadPending();
      return;
    }

    async function finalizeAuth() {
      try {
        const session = await getAuthSession();

        if (!session.authenticated) {
          throw new ApiError("Not authenticated", 401);
        }

        if (disposedRef.current) return;

        const redirectPath = getAuthenticatedRedirectPath(session, nextPath);
        if (redirectPath) router.replace(redirectPath);
      } catch (error) {
        if (disposedRef.current) return;

        setState("failed");
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setMessage(`Sign in did not complete. Please connect your ${providerName} account again.`);
          return;
        }

        setMessage("We could not complete your sign in flow. Please retry in a moment.");
      }
    }

    void finalizeAuth();
  }, [authStatus, nextPath, providerName, router]);

  // ── Checking / loading ────────────────────────────────────────────────────
  if (state === "checking") {
    return <PipelineLoader label={message} />;
  }

  // ── Archived choice ───────────────────────────────────────────────────────
  if (state === "archived_choice") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          {pendingSessionExpired || pendingAccount === null ? (
            <ArchivedSessionExpiredCard retryHref={retryLoginHref} />
          ) : (
            <ArchivedChoiceCard
              pending={pendingAccount as PendingAccountResponse & { pending: true }}
              nextPath={nextPath}
            />
          )}
        </div>
      </main>
    );
  }

  // ── Failed / error ────────────────────────────────────────────────────────
  const fc = failedContent(authStatus, message, searchParams.get("org"));
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

      {/* Corner frame markers — Lusion-style viewport frame */}
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

      {/* Oversized ghost word — fills the empty canvas on the right.
          Hidden on narrow viewports (see globals.css) where the full-width
          content would otherwise sit on top of it. */}
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

      {/* Content — anchored left, using the full canvas height */}
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
        <motion.p
          variants={prefersReducedMotion ? undefined : rise}
          className="file-path-label"
          style={{ margin: 0 }}
        >
          auth / access-gate
        </motion.p>

        <motion.div
          variants={prefersReducedMotion ? undefined : rise}
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
              animation: prefersReducedMotion ? undefined : "flowPulse 1.8s ease-in-out infinite",
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
          variants={prefersReducedMotion ? undefined : rise}
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
          variants={prefersReducedMotion ? undefined : rise}
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

        <motion.div
          variants={prefersReducedMotion ? undefined : rise}
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
        </motion.div>

        <motion.div
          variants={prefersReducedMotion ? undefined : rise}
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
