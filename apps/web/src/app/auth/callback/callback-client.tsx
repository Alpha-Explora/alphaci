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
    case "archived_choice":
      return "Checking archived account...";
    default:
      return "Finalizing sign in...";
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
      authStatus === "unavailable"
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
  return (
    <main className="dash-shell">
      <FlowBackground />

      <div className="state-body">
        <div className="state-card">
          <div
            className="state-icon"
            style={{ background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.25)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </div>
          <p className="hero-kicker" style={{ margin: 0 }}>
            {providerName} {intent === "signup" ? "Sign Up" : "Login"}
          </p>
          <h1>Authentication needs retry</h1>
          <p>{message}</p>
          <div className="hero-actions">
            <Link className="primary-button" href={retryLoginHref}>
              Retry {providerName} sign in
            </Link>
            <Link className="ghost-button" href="/">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
