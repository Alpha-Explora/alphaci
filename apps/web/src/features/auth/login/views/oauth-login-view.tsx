"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { DitherBackground } from "@/shared/layout/dither-background";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PublicSiteNav } from "@/shared/layout/public-site-nav";
import { useOAuthLoginViewModel } from "../view-models/use-oauth-login-view-model";

interface OAuthLoginViewProps {
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

export function OAuthLoginView({
  mode,
  title,
  subtitle,
  switchText,
  switchHref,
  switchCta,
}: Readonly<OAuthLoginViewProps>) {
  const prefersReducedMotion = useReducedMotion();
  const {
    status,
    isWarming,
    githubLoginHref,
    handleLogin,
    canQuickLogin,
    isQuickLoggingIn,
    quickLoginError,
    handleQuickLogin,
  } =
    useOAuthLoginViewModel(mode);

  return (
    <main className="auth-shell-split auth-shell-minimal relative bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <FlowBackground variant="calm" />
      <DitherBackground />
      <PublicSiteNav active="pricing" fixed showActions={false} />
      <InternalAccessPanel reduced={prefersReducedMotion} />
      <LoginCard mode={mode} title={title} subtitle={subtitle} switchText={switchText} switchHref={switchHref}
        switchCta={switchCta} reduced={prefersReducedMotion} status={status} isWarming={isWarming}
        githubLoginHref={githubLoginHref} handleLogin={handleLogin}
        canQuickLogin={canQuickLogin} isQuickLoggingIn={isQuickLoggingIn}
        quickLoginError={quickLoginError} handleQuickLogin={handleQuickLogin} />
    </main>
  );
}

function InternalAccessPanel({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return <div className="auth-left-panel"><div className="auth-internal-welcome"><motion.div className="auth-internal-copy" initial={reduced ? undefined : { opacity: 0, y: 16 }} animate={reduced ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}><p className="auth-internal-kicker">Internal workspace</p><h2>Alphaexplora internal access</h2><p>Sign in with your company GitHub to manage governed delivery workflows, organization repositories, provider connections, and deployments — all from one secure place.</p></motion.div><p className="auth-minimal-note">Access is gated on Alphaexplora organization membership — external accounts can&apos;t get in.</p></div></div>;
}

function LoginCard({ mode, title, subtitle, switchText, switchHref, switchCta, reduced, status, isWarming, githubLoginHref, handleLogin, canQuickLogin, isQuickLoggingIn, quickLoginError, handleQuickLogin }: Readonly<OAuthLoginViewProps & {
  reduced: boolean | null; status: string; isWarming: boolean; githubLoginHref: string;
  handleLogin: ReturnType<typeof useOAuthLoginViewModel>["handleLogin"];
  canQuickLogin: boolean; isQuickLoggingIn: boolean; quickLoginError: string | null;
  handleQuickLogin: ReturnType<typeof useOAuthLoginViewModel>["handleQuickLogin"];
}>) {
  return <div className="auth-right-panel"><motion.div className="auth-card-shell bg-white dark:bg-zinc-900" initial={reduced ? undefined : { opacity: 0, y: 14, scale: 0.985 }} animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
    <LoginHeader mode={mode} title={title} subtitle={subtitle} reduced={reduced} />
    <GitHubLoginButton mode={mode} isWarming={isWarming} href={githubLoginHref} handleLogin={handleLogin} />
    {mode === "login" && canQuickLogin ? <DevQuickLoginButton isLoggingIn={isQuickLoggingIn} onClick={handleQuickLogin} /> : null}
    {quickLoginError ? <p className="helper-text" role="alert">{quickLoginError}</p> : null}
    {status === "loading" ? <p className="helper-text">Checking current session...</p> : null}
    <div className="auth-trust-strip" aria-label="ALPHACI sign in protections"><span>GitHub OAuth</span><span>Branch-safe setup</span><span>Encrypted provider tokens</span></div>
    <SwitchPrompt text={switchText} href={switchHref} cta={switchCta} />
  </motion.div></div>;
}

function DevQuickLoginButton({ isLoggingIn, onClick }: Readonly<{ isLoggingIn: boolean; onClick: () => Promise<void> }>) {
  return <button type="button" className="auth-dev-quick-login" disabled={isLoggingIn} onClick={() => void onClick()}>
    {isLoggingIn ? "Starting local session..." : "Quick login · local development"}
  </button>;
}

function LoginHeader({ mode, title, subtitle, reduced }: Readonly<{ mode: OAuthLoginViewProps["mode"]; title: string; subtitle: string; reduced: boolean | null }>) {
  return <div className="auth-header"><motion.p className="hero-kicker" initial={reduced ? undefined : { opacity: 0, y: 8 }} animate={reduced ? undefined : { opacity: 1, y: 0 }}>{mode === "login" ? "Log in" : "Sign up"}</motion.p><motion.h1 initial={reduced ? undefined : { opacity: 0, y: 14 }} animate={reduced ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>{title}</motion.h1><p className="auth-subtitle">{subtitle}</p></div>;
}

function GitHubLoginButton({ mode, isWarming, href, handleLogin }: Readonly<{ mode: OAuthLoginViewProps["mode"]; isWarming: boolean; href: string; handleLogin: ReturnType<typeof useOAuthLoginViewModel>["handleLogin"] }>) {
  const label = isWarming ? "Connecting..." : mode === "login" ? "Continue with GitHub" : "Sign up with GitHub";
  return <div className="auth-provider-single"><motion.a href={href} aria-disabled={isWarming} className="auth-github-cta" style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", padding: "0.9rem 1.5rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.75rem", textDecoration: "none", transition: "border-color 0.2s ease, box-shadow 0.2s ease", cursor: "pointer", ...(isWarming ? { pointerEvents: "none", opacity: 0.6 } : {}) }} onMouseEnter={(event) => { event.currentTarget.style.borderColor = "rgba(162, 162, 172, 0.44)"; event.currentTarget.style.boxShadow = "0 12px 24px rgba(10, 10, 14, 0.2)"; }} onMouseLeave={resetGitHubButton} onClick={(event) => void handleLogin(event)}><span aria-hidden="true" style={{ display: "flex", alignItems: "center", flexShrink: 0, width: "20px", height: "20px", color: "var(--text-primary)" }}><GitHubGlyph /></span><span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", letterSpacing: "0.02em" }}>{label}</span></motion.a></div>;
}

function resetGitHubButton(event: React.MouseEvent<HTMLAnchorElement>) {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  event.currentTarget.style.borderColor = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  event.currentTarget.style.boxShadow = "none";
}

function SwitchPrompt({ text, href, cta }: Readonly<{ text?: string; href?: string; cta?: string }>) {
  if (!text || !href || !cta) return null;
  return <p className="auth-switch-text">{text} <Link href={href}>{cta}</Link></p>;
}
