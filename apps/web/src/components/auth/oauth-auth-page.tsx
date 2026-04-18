"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, type MouseEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { createGitHubLoginUrl, createGoogleLoginUrl } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

interface OAuthAuthPageProps {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  switchText: string;
  switchHref: string;
  switchCta: string;
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M22 12.23c0-.84-.08-1.63-.21-2.4h-9.74v4.55h5.58a4.76 4.76 0 0 1-2.07 3.12v2.59h3.34c1.95-1.8 3.1-4.46 3.1-7.86Z"
        fill="#4285F4"
      />
      <path
        d="M12.05 22.33c2.79 0 5.13-.92 6.84-2.5l-3.34-2.59c-.93.62-2.12 1-3.5 1-2.68 0-4.95-1.81-5.76-4.24H2.83v2.67a10.31 10.31 0 0 0 9.22 5.66Z"
        fill="#34A853"
      />
      <path
        d="M6.29 14c-.2-.61-.31-1.26-.31-1.94 0-.67.11-1.33.31-1.93V7.46H2.83A10.3 10.3 0 0 0 1.75 12c0 1.67.4 3.25 1.08 4.54L6.29 14Z"
        fill="#FBBC05"
      />
      <path
        d="M12.05 5.76c1.52 0 2.89.52 3.96 1.54l2.97-2.97a9.96 9.96 0 0 0-6.93-2.67A10.31 10.31 0 0 0 2.83 7.46l3.46 2.67c.81-2.42 3.08-4.37 5.76-4.37Z"
        fill="#EA4335"
      />
    </svg>
  );
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
  if (!raw) {
    return "/home";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

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

  const { status, session, error } = useAuthSession();

  const nextPath = useMemo(() => toSafeNextPath(searchParams.get("next")), [searchParams]);
  const githubCallbackReturnTo = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent: mode,
      next: nextPath,
      provider: "github",
    });

    return `/auth/callback?${callbackPath.toString()}`;
  }, [mode, nextPath]);

  const googleCallbackReturnTo = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent: mode,
      next: nextPath,
      provider: "google",
    });

    return `/auth/callback?${callbackPath.toString()}`;
  }, [mode, nextPath]);

  const githubLoginHref = useMemo(() => createGitHubLoginUrl(githubCallbackReturnTo), [githubCallbackReturnTo]);
  const googleLoginHref = useMemo(() => createGoogleLoginUrl(googleCallbackReturnTo), [googleCallbackReturnTo]);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [3.2, -3.2]), {
    stiffness: 190,
    damping: 24,
    mass: 0.45,
  });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-3.2, 3.2]), {
    stiffness: 190,
    damping: 24,
    mass: 0.45,
  });

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

  function handleCardPointerMove(event: MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    pointerX.set(Math.max(-0.5, Math.min(0.5, x)));
    pointerY.set(Math.max(-0.5, Math.min(0.5, y)));
  }

  function handleCardPointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <main className="flow-shell page-shell auth-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/subscribe">Pricing</Link>
        </nav>
        <Link className="ghost-button" href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? "Sign up" : "Login"}
        </Link>
      </header>

      <section className="section-card auth-card glass-panel auth-card-modern">
        <motion.div
          className="auth-card-shell"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14, scale: 0.985 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          onMouseMove={handleCardPointerMove}
          onMouseLeave={handleCardPointerLeave}
          style={
            prefersReducedMotion
              ? undefined
              : {
                  transformPerspective: 1100,
                  rotateX,
                  rotateY,
                }
          }
        >
          <span className="auth-card-glint" aria-hidden="true" />
          <span className="auth-depth-orb auth-depth-orb-a" aria-hidden="true" />
          <span className="auth-depth-orb auth-depth-orb-b" aria-hidden="true" />

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

          <fieldset className="auth-provider-grid" aria-label="Authentication providers">
            <Link className="auth-provider-button provider-google" href={googleLoginHref}>
              <span className="auth-provider-icon" aria-hidden="true">
                <GoogleGlyph />
              </span>
              <span className="auth-provider-copy">
                <span className="auth-provider-label">
                  {mode === "login" ? "Continue with Google" : "Sign up with Google"}
                </span>
                <span className="auth-provider-meta">Fastest sign in for product teams</span>
              </span>
            </Link>

            <Link className="auth-provider-button provider-github" href={githubLoginHref}>
              <span className="auth-provider-icon" aria-hidden="true">
                <GitHubGlyph />
              </span>
              <span className="auth-provider-copy">
                <span className="auth-provider-label">
                  {mode === "login" ? "Continue with GitHub" : "Sign up with GitHub"}
                </span>
                <span className="auth-provider-meta">Best path for workflow templates</span>
              </span>
            </Link>
          </fieldset>

          <div className="auth-support-row">
            <Link className="ghost-button auth-support-link" href="/subscribe">
              View 300 pesos plan
            </Link>
            <Link className="ghost-button auth-support-link" href="/">
              Go to Home
            </Link>
          </div>

          {status === "loading" ? <p className="helper-text">Checking current session...</p> : null}
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          <p className="auth-switch-text">
            {switchText} <Link href={switchHref}>{switchCta}</Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
}
