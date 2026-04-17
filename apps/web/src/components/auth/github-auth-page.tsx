"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { createDummyLoginUrl, createGitHubLoginUrl } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

interface GitHubAuthPageProps {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  primaryCta: string;
  switchText: string;
  switchHref: string;
  switchCta: string;
}

function toSafeNextPath(raw: string | null): string {
  if (!raw) {
    return "/home";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  return "/home";
}

export function GitHubAuthPage({
  mode,
  title,
  subtitle,
  primaryCta,
  switchText,
  switchHref,
  switchCta,
}: Readonly<GitHubAuthPageProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const { status, session, error } = useAuthSession();

  const nextPath = useMemo(() => toSafeNextPath(searchParams.get("next")), [searchParams]);
  const callbackReturnTo = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent: mode,
      next: nextPath,
    });

    return `/auth/callback?${callbackPath.toString()}`;
  }, [mode, nextPath]);

  const githubLoginHref = useMemo(() => createGitHubLoginUrl(callbackReturnTo), [callbackReturnTo]);
  const dummyLoginHref = useMemo(
    () => createDummyLoginUrl(callbackReturnTo, "dummy-pro-active"),
    [callbackReturnTo],
  );
  const dummyEnterpriseHref = useMemo(
    () => createDummyLoginUrl(callbackReturnTo, "dummy-enterprise-active"),
    [callbackReturnTo],
  );
  const showDummyAccounts = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (status !== "signed-in") {
      return;
    }

    if (hasActiveSubscription(session)) {
      router.replace(nextPath);
      return;
    }

    router.replace("/subscribe");
  }, [nextPath, router, session, status]);

  return (
    <main className="flow-shell page-shell auth-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/">Landing</Link>
          <Link href="/subscribe">Pricing</Link>
        </nav>
        <Link className="ghost-button" href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? "Sign up" : "Login"}
        </Link>
      </header>

      <section className="section-card auth-card glass-panel">
        <motion.p
          className="hero-kicker"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          GitHub {mode === "login" ? "Sign In" : "Sign Up"}
        </motion.p>
        <motion.h1
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {title}
        </motion.h1>
        <p className="auth-subtitle">{subtitle}</p>

        <div className="hero-actions">
          <Link className="primary-button" href={githubLoginHref}>
            {primaryCta}
          </Link>
          <Link className="ghost-button" href="/subscribe">
            View 300 pesos plan
          </Link>
        </div>

        {showDummyAccounts ? (
          <div className="auth-dummy-row" aria-label="Dummy accounts for local development">
            <p className="helper-text">Local quick sign in:</p>
            <div className="hero-actions">
              <Link className="ghost-button" href={dummyLoginHref}>
                Dummy Pro
              </Link>
              <Link className="ghost-button" href={dummyEnterpriseHref}>
                Dummy Enterprise
              </Link>
            </div>
          </div>
        ) : null}

        {status === "loading" ? <p className="helper-text">Checking current session...</p> : null}
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <p className="auth-switch-text">
          {switchText} <Link href={switchHref}>{switchCta}</Link>
        </p>
      </section>
    </main>
  );
}
