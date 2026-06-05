"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { isGuest } from "@/lib/auth/subscription";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.77.5 12.27c0 5.2 3.3 9.6 7.88 11.15.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.53-1.37-1.29-1.73-1.29-1.73-1.05-.74.08-.73.08-.73 1.17.08 1.78 1.22 1.78 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.72-1.58-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.33 1.18-3.16-.12-.3-.51-1.53.11-3.19 0 0 .97-.32 3.18 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.52 3.17-1.2 3.17-1.2.63 1.66.24 2.9.12 3.19.73.83 1.17 1.88 1.17 3.16 0 4.51-2.71 5.49-5.3 5.78.41.37.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .31.21.69.8.57a11.83 11.83 0 0 0 7.87-11.15C23.5 5.77 18.35.5 12 .5Z" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function CreditCardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function UserIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AlertTriangleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ── Settings section card ─────────────────────────────────────────────────── */

function SettingsSection({
  icon,
  title,
  children,
  index = 0,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  index?: number;
  danger?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
      style={{
        background: danger ? "rgba(248, 113, 113, 0.08)" : "rgba(30, 41, 59, 0.92)",
        border: danger ? "1px solid rgba(248, 113, 113, 0.3)" : "1px solid rgba(255,255,255,0.12)",
        borderRadius: "1rem",
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.85rem 1.25rem",
          borderBottom: danger ? "1px solid rgba(248, 113, 113, 0.2)" : "1px solid rgba(255,255,255,0.08)",
          background: danger ? "rgba(248, 113, 113, 0.06)" : "rgba(15, 23, 42, 0.7)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "0.4rem",
            background: danger ? "rgba(248, 113, 113, 0.12)" : "rgba(56, 189, 248, 0.1)",
            color: danger ? "var(--danger)" : "var(--brand)",
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: danger ? "var(--danger)" : "var(--text-secondary)",
          }}
        >
          {title}
        </span>
      </div>

      {/* Section body */}
      <div style={{ padding: "1.25rem" }}>
        {children}
      </div>
    </motion.div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"account" | "connections" | "billing" | "danger">("account");

  useEffect(() => {
    if (status === "signed-out") {
      router.push("/login?next=/settings");
    }
  }, [status, router]);

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

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (status === "loading") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <header className="marketing-nav">
          <div className="brand-mark">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </div>
        </header>
        <div className="state-body">
          <div className="state-card">
            <div className="state-spinner" role="status" aria-label="Loading settings" />
            <h1>Loading settings</h1>
            <p>Fetching your account configuration.</p>
          </div>
        </div>
      </main>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <header className="marketing-nav">
          <div className="brand-mark">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </div>
          <Link className="ghost-button" href="/login?next=/settings">Sign in</Link>
        </header>
        <div className="state-body">
          <div className="state-card">
            <div
              className="state-icon"
              style={{ background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.2)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1>Session verification failed</h1>
            <p>We could not verify your session. Please retry or sign in again.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => void refresh()}>Retry</button>
              <Link className="ghost-button" href="/login?next=/settings">Go to login</Link>
            </div>
            {error ? <p className="error-text" style={{ fontSize: "0.82rem" }}>{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  const guest = isGuest(session);
  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

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

      <div
        id="main-content"
        style={{
          padding: "1.5rem var(--layout-gutter) 2rem",
          flex: 1,
          display: "flex",
          gap: "1.75rem",
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        {/* ── Left sidebar ── */}
        <nav
          aria-label="Settings sections"
          style={{
            width: "220px",
            flexShrink: 0,
            position: "sticky",
            top: "72px",
            alignSelf: "flex-start",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            background: "rgba(15, 23, 42, 0.72)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "1rem",
            padding: "1rem",
          }}
        >
          {/* Mini profile summary in sidebar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              paddingBottom: "0.85rem",
              marginBottom: "0.5rem",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                position: "relative",
                borderRadius: "50%",
                padding: "1.5px",
                background: "linear-gradient(135deg, var(--brand), var(--brand-accent))",
                flexShrink: 0,
              }}
            >
              {session?.user.avatarUrl ? (
                <Image
                  src={session.user.avatarUrl}
                  alt={session.user.name ?? session.user.login}
                  width={36}
                  height={36}
                  style={{ borderRadius: "50%", display: "block", border: "2px solid var(--bg-base)" }}
                  unoptimized
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--bg-elevated)",
                    color: "var(--brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    border: "2px solid var(--bg-base)",
                  }}
                >
                  {avatarInitial}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session?.user.name ?? session?.user.login ?? "Account"}
              </p>
              {session?.subscription.plan && (
                <span style={{
                  fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  padding: "0.1rem 0.4rem", borderRadius: "3px",
                  background: "rgba(56,189,248,0.15)", color: "var(--brand)",
                  border: "1px solid rgba(56,189,248,0.2)",
                }}>
                  {session.subscription.plan}
                </span>
              )}
            </div>
          </div>

          {/* Section nav buttons */}
          {(["account", "connections", "billing", "danger"] as const).map((sec) => {
            const isActive = activeSection === sec;
            const isDanger = sec === "danger";
            const labels: Record<typeof sec, string> = {
              account: "Account",
              connections: "Connections",
              billing: "Billing",
              danger: "Danger Zone",
            };
            const icons: Record<typeof sec, React.ReactNode> = {
              account: <UserIcon size={14} />,
              connections: <GithubIcon size={14} />,
              billing: <CreditCardIcon size={14} />,
              danger: <AlertTriangleIcon size={14} />,
            };
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setActiveSection(sec)}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 0.75rem", borderRadius: "0.6rem",
                  fontSize: "0.83rem", fontWeight: 600,
                  width: "100%", textAlign: "left",
                  border: isActive
                    ? isDanger ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(56,189,248,0.25)"
                    : "1px solid transparent",
                  background: isActive
                    ? isDanger ? "rgba(248,113,113,0.08)" : "rgba(56,189,248,0.1)"
                    : "transparent",
                  color: isActive
                    ? isDanger ? "var(--danger)" : "var(--brand)"
                    : isDanger ? "rgba(248,113,113,0.7)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {icons[sec]}
                {labels[sec]}
              </button>
            );
          })}
        </nav>

        {/* ── Right content ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              {activeSection === "account" && (
                <>
                  {/* ── Profile header card ──────────────────────────────────────── */}
                  <motion.div
                    initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      position: "relative",
                      borderRadius: "1.25rem",
                      overflow: "hidden",
                      background: "linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(52, 211, 153, 0.04) 60%, rgba(15, 23, 42, 0.5) 100%)",
                      border: "1px solid rgba(56, 189, 248, 0.2)",
                      padding: "clamp(1.5rem, 3vw, 2rem)",
                    }}
                  >
                    {/* Top gradient bar */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
                      }}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
                      {/* Avatar with gradient ring */}
                      <div
                        style={{
                          position: "relative",
                          borderRadius: "50%",
                          padding: "2.5px",
                          background: "linear-gradient(135deg, var(--brand), var(--brand-accent))",
                          flexShrink: 0,
                        }}
                      >
                        {session?.user.avatarUrl ? (
                          <Image
                            src={session.user.avatarUrl}
                            alt={session.user.name ?? session.user.login}
                            width={64}
                            height={64}
                            style={{
                              borderRadius: "50%",
                              display: "block",
                              border: "2px solid var(--bg-base)",
                            }}
                            unoptimized
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            style={{
                              width: "64px",
                              height: "64px",
                              borderRadius: "50%",
                              background: "var(--bg-elevated)",
                              color: "var(--brand)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.5rem",
                              fontWeight: 700,
                              border: "2px solid var(--bg-base)",
                            }}
                          >
                            {avatarInitial}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            color: "var(--brand)",
                            margin: "0 0 0.25rem",
                          }}
                        >
                          SETTINGS / ACCOUNT
                        </p>
                        <h1
                          style={{
                            fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                            fontWeight: 800,
                            margin: "0 0 0.2rem",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {session?.user.name ?? session?.user.login ?? "Your account"}
                        </h1>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                          {session?.user.login && (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                fontFamily: "ui-monospace, monospace",
                              }}
                            >
                              <GithubIcon size={13} />
                              @{session.user.login}
                            </span>
                          )}
                          {session?.user.email && (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {session.user.email}
                            </span>
                          )}
                          {session?.subscription.plan && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "4px",
                                background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(52, 211, 153, 0.08))",
                                color: "var(--brand)",
                                border: "1px solid rgba(56, 189, 248, 0.25)",
                              }}
                            >
                              {session.subscription.plan} plan
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* ── Account identity section ───────────────────────────── */}
                  <SettingsSection icon={<UserIcon />} title="Account" index={0}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Display name
                          </span>
                          <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {session?.user.name ?? "—"}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            GitHub login
                          </span>
                          <span
                            style={{
                              fontSize: "0.88rem",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              fontFamily: "ui-monospace, monospace",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <GithubIcon size={13} />
                            {session?.user.login ?? "—"}
                          </span>
                        </div>
                      </div>

                      {session?.user.email && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Email
                          </span>
                          <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                            {session.user.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </SettingsSection>
                </>
              )}

              {activeSection === "connections" && (
                <SettingsSection icon={<GithubIcon />} title="GitHub Connection" index={0}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {/* Connected status indicator */}
                        <span
                          aria-hidden="true"
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "var(--success)",
                            boxShadow: "0 0 8px rgba(52, 211, 153, 0.6)",
                            animation: "flowPulse 2s ease-in-out infinite",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          GitHub App connected
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        Manage your GitHub App connection from the Create Project page.
                      </p>
                    </div>
                    <Link
                      href="/workflows"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--brand)",
                        textDecoration: "none",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "0.5rem",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        background: "rgba(56, 189, 248, 0.06)",
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      Manage
                      <ExternalLinkIcon size={11} />
                    </Link>
                  </div>
                </SettingsSection>
              )}

              {activeSection === "billing" && (
                <SettingsSection icon={<CreditCardIcon />} title="Billing" index={0}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {session?.subscription.plan
                          ? `${session.subscription.plan.charAt(0).toUpperCase() + session.subscription.plan.slice(1)} plan`
                          : "No active plan"}
                      </span>
                      {session?.subscription.status && (
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: session.subscription.status === "active" ? "var(--success)" : "var(--text-muted)",
                            textTransform: "capitalize",
                          }}
                        >
                          Status: {session.subscription.status}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/subscribe"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--brand)",
                        textDecoration: "none",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "0.5rem",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        background: "rgba(56, 189, 248, 0.06)",
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      View plan
                      <ExternalLinkIcon size={11} />
                    </Link>
                  </div>
                </SettingsSection>
              )}

              {activeSection === "danger" && (
                <SettingsSection icon={<AlertTriangleIcon />} title="Danger Zone" index={0} danger>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        Sign out of FlowCI Studio
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Your session will be terminated and you will be redirected to the home page.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--danger)",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "0.5rem",
                        border: "1px solid rgba(248, 113, 113, 0.3)",
                        background: "rgba(248, 113, 113, 0.06)",
                        cursor: isLoggingOut ? "not-allowed" : "pointer",
                        opacity: isLoggingOut ? 0.6 : 1,
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      {isLoggingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                  {logoutMessage && (
                    <p className="error-text" style={{ marginTop: "0.75rem" }}>{logoutMessage}</p>
                  )}
                </SettingsSection>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
