"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PublicSiteNav } from "@/components/layout/public-site-nav";
import { useAuthSession } from "@/hooks/use-auth-session";
import { createGitHubLoginUrl, warmupBackend } from "@/lib/api/client";
import { getAuthenticatedRedirectPath } from "@/lib/auth/subscription";

interface OAuthAuthPageProps {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  switchText?: string;
  switchHref?: string;
  switchCta?: string;
}

function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.77.5 12.27c0 5.2 3.3 9.6 7.88 11.15.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.53-1.37-1.29-1.73-1.29-1.73-1.05-.74.08-.73.08-.73 1.17.08 1.78 1.22 1.78 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.72-1.58-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.33 1.18-3.16-.12-.3-.51-1.53.11-3.19 0 0 .97-.32 3.18 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.52 3.17-1.2 3.17-1.2.63 1.66.24 2.9.12 3.19.73.83 1.17 1.88 1.17 3.16 0 4.51-2.71 5.49-5.3 5.78.41.37.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .31.21.69.8.57a11.83 11.83 0 0 0 7.87-11.15C23.5 5.77 18.35.5 12 .5Z"
      />
    </svg>
  );
}

function toSafeNextPath(raw: string | null): string {
  if (!raw) return "/home";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/home";
}

export function OAuthAuthPage({
  mode,
  title,
  subtitle,
  switchText,
  switchHref,
  switchCta,
}: Readonly<OAuthAuthPageProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [isWarming, setIsWarming] = useState<boolean>(false);
  const [browserOrigin, setBrowserOrigin] = useState<string | null>(null);

  const { status, session } = useAuthSession();

  const nextPath = useMemo(
    () => toSafeNextPath(searchParams.get("next")),
    [searchParams],
  );
  const githubCallbackReturnTo = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent: mode,
      next: nextPath,
      provider: "github",
    });
    const relativeCallbackPath = `/auth/callback?${callbackPath.toString()}`;
    return browserOrigin
      ? `${browserOrigin}${relativeCallbackPath}`
      : relativeCallbackPath;
  }, [browserOrigin, mode, nextPath]);

  const githubLoginHref = useMemo(
    () => createGitHubLoginUrl(githubCallbackReturnTo),
    [githubCallbackReturnTo],
  );

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (status !== "signed-in") return;
    const redirectPath = getAuthenticatedRedirectPath(session, nextPath);
    if (redirectPath) router.replace(redirectPath);
  }, [nextPath, router, session, status]);

  return (
    <main className="auth-shell-split auth-shell-minimal">
      <FlowBackground variant="calm" />
      <PublicSiteNav active="pricing" fixed showActions={false} />

      <div className="auth-left-panel">
        <div className="auth-internal-welcome">
          <motion.div
            className="auth-internal-eyebrow"
            initial={
              prefersReducedMotion
                ? undefined
                : { opacity: 0, y: 16, scale: 0.96 }
            }
            animate={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
            }
            transition={{
              duration: 0.55,
              delay: 0.15,
              ease: [0.25, 1, 0.5, 1],
            }}
          >
            <span className="auth-internal-seal" aria-hidden="true">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                focusable="false"
              >
                <path
                  d="M8 12.5 10.5 15 16 9"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 3 19 6.1v5.3c0 4.4-2.8 8.3-7 9.6-4.2-1.3-7-5.2-7-9.6V6.1L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <span>Internal workspace</span>
              <strong>GitHub verifies ALPHACI membership before entry.</strong>
            </div>
          </motion.div>

          <motion.div
            className="auth-internal-copy"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <p className="auth-internal-kicker">Welcome back</p>
            <h2>ALPHACI internal access</h2>
            <p>
              Sign in with GitHub to continue managing governed delivery
              workflows, organization repositories, provider connections, and
              deployment activity from one secure control surface.
            </p>
          </motion.div>

          <p className="auth-minimal-note">
            One secure workspace for repositories, delivery workflows, and
            deployment activity.
          </p>
        </div>
      </div>

      <div className="auth-right-panel">
        <motion.div
          className="auth-card-shell"
          initial={
            prefersReducedMotion
              ? undefined
              : { opacity: 0, y: 14, scale: 0.985 }
          }
          animate={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="auth-header">
            <motion.p
              className="hero-kicker"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            >
              {mode === "login" ? "Log in" : "Sign up"}
            </motion.p>
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {title}
            </motion.h1>
            <p className="auth-subtitle">{subtitle}</p>
          </div>

          <div className="auth-provider-single">
            <motion.a
              href={githubLoginHref}
              aria-disabled={isWarming}
              className="auth-github-cta"
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: 1.01,
                      boxShadow: "0 0 24px rgba(56, 189, 248, 0.2)",
                    }
              }
              whileTap={{ scale: 0.98 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                width: "100%",
                padding: "0.9rem 1.5rem",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "0.75rem",
                textDecoration: "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                cursor: "pointer",
                ...(isWarming ? { pointerEvents: "none", opacity: 0.6 } : {}),
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "rgba(56, 189, 248, 0.6)";
                el.style.boxShadow = "0 0 20px rgba(56,189,248,0.15)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                const isLight =
                  document.documentElement.getAttribute("data-theme") ===
                  "light";
                el.style.borderColor = isLight
                  ? "rgba(0,0,0,0.12)"
                  : "rgba(255,255,255,0.12)";
                el.style.boxShadow = "none";
              }}
              onClick={async (e) => {
                e.preventDefault();
                setIsWarming(true);
                try {
                  await warmupBackend();
                } catch {
                  // Intentionally swallowed — warmup failure must not block login.
                } finally {
                  setIsWarming(false);
                }
                window.location.href = githubLoginHref;
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  width: "20px",
                  height: "20px",
                  color: "var(--text-primary)",
                }}
              >
                <GitHubGlyph />
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--text-primary)",
                  letterSpacing: "0.02em",
                }}
              >
                {isWarming
                  ? "Connecting..."
                  : mode === "login"
                    ? "Continue with GitHub"
                    : "Sign up with GitHub"}
              </span>
            </motion.a>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: "0.5rem",
              }}
            >
              Your repos, pipelines, and workflow history stay connected.
            </p>
          </div>

          {status === "loading" ? (
            <p className="helper-text">Checking current session...</p>
          ) : null}

          <div
            className="auth-trust-strip"
            aria-label="ALPHACI sign in protections"
          >
            <span>GitHub OAuth</span>
            <span>Branch-safe setup</span>
            <span>Encrypted provider tokens</span>
          </div>

          {switchText && switchHref && switchCta ? (
            <p className="auth-switch-text">
              {switchText} <Link href={switchHref}>{switchCta}</Link>
            </p>
          ) : null}
        </motion.div>
      </div>
    </main>
  );
}
