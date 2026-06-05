"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { PipelineLogo } from "@/components/layout/pipeline-logo";
import type { useAuthSession } from "@/hooks/use-auth-session";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AppNavProps {
  guest: boolean;
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
}

/* ── Nav items ─────────────────────────────────────────────────────────────── */

const coreNavItems = [
  { label: "Dashboard",  href: "/home",      icon: DashboardIcon },
  { label: "Workflows",  href: "/workflows",  icon: WorkflowsIcon },
];

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function DashboardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function WorkflowsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function BillingIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function SettingsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49" />
    </svg>
  );
}

function SignOutIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── Tooltip ───────────────────────────────────────────────────────────────── */

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "0.4rem",
              padding: "0.3rem 0.6rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              pointerEvents: "none",
              zIndex: 200,
            }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── AppNav ─────────────────────────────────────────────────────────────────── */

export function AppNav({ guest, session, onLogout, isLoggingOut }: Readonly<AppNavProps>) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

  // Add scroll-shadow when page is scrolled
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Build nav items depending on auth state
  const navItems = [
    ...coreNavItems,
    guest
      ? { label: "Billing",   href: "/subscribe", icon: BillingIcon }
      : { label: "Settings",  href: "/settings",  icon: SettingsIcon },
  ];

  return (
    <header
      ref={navRef}
      className="app-nav-premium"
      style={{
        background: scrolled ? "rgba(2, 6, 23, 0.85)" : "rgba(2, 6, 23, 0.7)",
        backdropFilter: "blur(32px) saturate(200%)",
        WebkitBackdropFilter: "blur(32px) saturate(200%)",
        borderBottom: scrolled
          ? "1px solid rgba(56, 189, 248, 0.18)"
          : "1px solid rgba(255, 255, 255, 0.07)",
        boxShadow: scrolled
          ? "0 4px 30px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(56, 189, 248, 0.12)"
          : "0 4px 30px rgba(0, 0, 0, 0.3)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderRadius: 0,
        margin: "0",
        padding: "0 var(--layout-gutter)",
        display: "flex",
        alignItems: "center",
        minHeight: "3.25rem",
        gap: "0",
        transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      {/* Brand */}
      <Link
        className="brand-mark"
        href="/home"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
      >
        <PipelineLogo size={22} />
        <span
          style={{
            fontWeight: 800,
            background: "linear-gradient(to right, #fff, var(--text-secondary))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "#fff",
            fontSize: "0.88rem",
          }}
        >
          FlowCI Studio
        </span>
      </Link>

      {/* Separator */}
      <span
        aria-hidden="true"
        style={{
          width: "1px",
          height: "1.5rem",
          background: "var(--border-soft)",
          margin: "0 1rem",
          flexShrink: 0,
        }}
      />

      {/* Primary nav */}
      <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const NavIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.9rem",
                borderRadius: "0.5rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: isActive ? "var(--brand)" : "var(--text-secondary)",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="app-nav-pill"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "0.5rem",
                    background: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    boxShadow: "0 0 12px rgba(56, 189, 248, 0.1)",
                    zIndex: -1,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <NavIcon size={13} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: user pill + sign out */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
        {!guest && (
          <>
            {/* User pill */}
            <div
              className="user-pill-premium"
              aria-label={`Signed in as ${session?.user.login ?? "user"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-pill)",
                padding: "0.25rem 0.75rem 0.25rem 0.25rem",
                position: "relative",
              }}
            >
              {/* Avatar with gradient ring */}
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
                    width={22}
                    height={22}
                    style={{ borderRadius: "50%", display: "block" }}
                    unoptimized
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--bg-elevated)",
                      color: "var(--brand)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    {avatarInitial}
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  maxWidth: "6rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session?.user.login ?? "user"}
              </span>

              {session?.subscription.plan && (
                <span
                  style={{
                    fontSize: "0.63rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(52, 211, 153, 0.1))",
                    color: "var(--brand)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                  }}
                >
                  {session.subscription.plan}
                </span>
              )}
            </div>

            {/* Sign out — icon-only with tooltip */}
            <Tooltip text={isLoggingOut ? "Signing out…" : "Sign out"}>
              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? "Signing out…" : "Sign out"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  background: "rgba(15, 23, 42, 0.4)",
                  color: "var(--text-muted)",
                  cursor: isLoggingOut ? "not-allowed" : "pointer",
                  opacity: isLoggingOut ? 0.6 : 1,
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isLoggingOut) {
                    e.currentTarget.style.color = "var(--danger)";
                    e.currentTarget.style.borderColor = "rgba(248, 113, 113, 0.4)";
                    e.currentTarget.style.background = "rgba(248, 113, 113, 0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "rgba(15, 23, 42, 0.4)";
                }}
              >
                {isLoggingOut ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: "13px",
                      height: "13px",
                      borderRadius: "50%",
                      border: "1.5px solid rgba(255,255,255,0.15)",
                      borderTopColor: "var(--brand)",
                      display: "block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                ) : (
                  <SignOutIcon />
                )}
              </button>
            </Tooltip>
          </>
        )}

        {guest && (
          <Link
            className="primary-button"
            href="/signup"
            style={{ padding: "0.4rem 1rem", fontSize: "0.82rem", minHeight: "2.2rem" }}
          >
            Sign up
          </Link>
        )}
      </div>
    </header>
  );
}
