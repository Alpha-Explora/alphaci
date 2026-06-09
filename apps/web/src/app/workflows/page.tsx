"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { WorkflowBuilder } from "../../components/product/workflow-builder";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { isGuest } from "@/lib/auth/subscription";

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function WorkflowsPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut]   = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage(null);
    try {
      await logout();
      await refresh();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  /* ── Guard: loading ─────────────────────────────────────────────────────── */
  if (status === "loading") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <header className="dash-nav">
          <Link className="brand-mark" href="/home">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </Link>
        </header>
        <div className="state-body" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '32px',
            padding: '64px 80px',
            boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 40px rgba(56, 189, 248, 0.05)',
            overflow: 'hidden'
          }}>
            {/* Background glowing orb */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.15), transparent 50%)',
              animation: 'spin 15s linear infinite'
            }} />
            
            {/* Spinner Container */}
            <div style={{ position: 'relative', width: '90px', height: '90px', marginBottom: '36px' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(56, 189, 248, 0.1)',
                borderTopColor: '#38bdf8', animation: 'spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite'
              }} />
              <div style={{
                position: 'absolute', inset: '12px', borderRadius: '50%', border: '3px solid rgba(139, 92, 246, 0.1)',
                borderTopColor: '#8b5cf6', animation: 'spin 1.5s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse'
              }} />
              <div style={{
                position: 'absolute', inset: '24px', borderRadius: '50%', border: '3px solid rgba(236, 72, 153, 0.1)',
                borderTopColor: '#ec4899', animation: 'spin 2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
              }} />
              
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 60%)',
                animation: 'pulseOrb 2s ease-in-out infinite'
              }} />
              
              {/* Center Logo */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.5))'
              }}>
                <PipelineLogo size={28} />
              </div>
            </div>
            
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 800, 
              margin: '0 0 16px 0',
              letterSpacing: '-0.04em',
              background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              position: 'relative'
            }}>
              Loading Create Project
            </h1>
            
            <p style={{ 
              fontSize: '1.05rem', 
              color: '#94a3b8', 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: 500,
              position: 'relative'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#38bdf8',
                boxShadow: '0 0 12px #38bdf8',
                animation: 'pulseOrb 1.5s ease-in-out infinite'
              }} />
              Preparing your workflow studio
              <span style={{ display: 'inline-flex', width: '24px' }}>
                <span style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }}>.</span>
                <span style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }}>.</span>
                <span style={{ animation: 'bounce 1.4s infinite ease-in-out both' }}>.</span>
              </span>
            </p>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes pulseOrb { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } }
          @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        `}} />
      </main>
    );
  }

  /* ── Guard: error ───────────────────────────────────────────────────────── */
  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <header className="dash-nav">
          <Link className="brand-mark" href="/home">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </Link>
          <div className="nav-right">
            <Link className="ghost-button" href="/login?next=/workflows" style={{ padding: "0.2rem 0.75rem", fontSize: "0.82rem", minHeight: "1.8rem" }}>Sign in</Link>
          </div>
        </header>
        <div className="state-body">
          <div className="state-card">
            <div className="state-icon" style={{ background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.2)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1>Session verification failed</h1>
            <p>We could not verify your workflow access. Retry or sign in again.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => void refresh()}>
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/workflows">Go to login</Link>
            </div>
            {error ? <p className="error-text" style={{ fontSize: "0.82rem" }}>{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  /* ── Signed-in or guest preview ─────────────────────────────────────────── */
  const guest = isGuest(session);

  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      {guest && (
        <div className="guest-banner" role="alert">
          <p className="guest-banner-text">
            You are viewing FlowCI Studio in preview mode. Sign up to unlock all features.
          </p>
          <div className="guest-banner-actions">
            <Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}>
              Sign up free
            </Link>
            <Link className="ghost-button" href="/login" style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}>
              Log in
            </Link>
          </div>
        </div>
      )}

      {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}

      <div id="main-content" style={{ padding: "0" }}>
        <div style={{
          padding: "1.75rem var(--layout-gutter) 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "linear-gradient(180deg, rgba(56,189,248,0.03) 0%, transparent 100%)",
        }}>
          <div>
            <p style={{
              margin: "0 0 0.3rem",
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--brand)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}>
              <span style={{ opacity: 0.6 }}>FlowCI Studio</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>Workflows</span>
            </p>
            <h1 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", margin: 0, letterSpacing: "-0.02em" }}>
              Create &amp; Manage Projects
            </h1>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Generate GitHub Actions workflows, manage repositories, and browse the template catalog.
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.85rem",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "0.65rem",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--success)",
              boxShadow: "0 0 6px rgba(52,211,153,0.5)",
              animation: "flowPulse 2s ease-in-out infinite",
              display: "inline-block",
            }} />
            Studio active
          </div>
        </div>
        <WorkflowBuilder
          login={session?.user.login ?? "builder"}
          plan={session?.subscription.plan ?? "pro"}
          guest={guest}
        />
      </div>
    </main>
  );
}
