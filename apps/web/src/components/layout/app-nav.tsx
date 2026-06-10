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
  { label: "Dashboard",  href: "/home",      icon: DashboardIcon,  key: "dashboard" },
  { label: "Workflows",  href: "/workflows",  icon: WorkflowsIcon,  key: "workflows" },
];

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function DashboardIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function WorkflowsIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function BillingIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function SettingsIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49" />
    </svg>
  );
}

function SignOutIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── Pipeline node motif — decorative, 5 stages ────────────────────────────── */

function NavPipelineMotif() {
  return (
    <span className="nav-pipeline-motif" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="nav-pipeline-motif-group">
          <span
            className="nav-pipeline-motif-dot"
            style={{ animationDelay: `${i * 0.32}s` }}
          />
          {i < 4 && <span className="nav-pipeline-motif-connector" />}
        </span>
      ))}
    </span>
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

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 8); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    ...coreNavItems,
    guest
      ? { label: "Billing",  href: "/subscribe", icon: BillingIcon,  key: "billing" }
      : { label: "Settings", href: "/settings",  icon: SettingsIcon, key: "settings" },
  ];

  return (
    <header
      ref={navRef}
      className={`app-nav-dock${scrolled ? " app-nav-dock--scrolled" : ""}`}
      role="banner"
    >
      {/* Gradient hairline top border */}
      <span className="nav-hairline" aria-hidden="true" />

      {/* Inner pill container */}
      <div className="nav-inner">

        {/* Brand mark */}
        <Link className="nav-brand" href="/home" aria-label="FlowCI Studio — home">
          <span className="nav-brand-logo-ring">
            <PipelineLogo size={18} />
          </span>
          <span className="nav-brand-wordmark">
            FlowCI<span className="nav-brand-accent">Studio</span>
          </span>
          <NavPipelineMotif />
        </Link>

        {/* Separator */}
        <span className="nav-sep" aria-hidden="true" />

        {/* Primary nav — floating pill dock */}
        <nav className="nav-links" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const NavIcon  = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`nav-link${isActive ? " nav-link--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="app-nav-active-pill"
                    className="nav-link-bg"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    aria-hidden="true"
                  />
                )}
                <NavIcon size={12} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: user identity + sign out */}
        <div className="nav-right-cluster">
          {!guest && (
            <>
              {/* User identity pill */}
              <div className="nav-user-pill" aria-label={`Signed in as ${session?.user.login ?? "user"}`}>
                <span className="nav-user-avatar-ring">
                  {session?.user.avatarUrl ? (
                    <Image
                      src={session.user.avatarUrl}
                      alt={session.user.name ?? session.user.login}
                      width={20}
                      height={20}
                      className="nav-user-avatar-img"
                      unoptimized
                    />
                  ) : (
                    <span className="nav-user-avatar-fallback" aria-hidden="true">
                      {avatarInitial}
                    </span>
                  )}
                </span>

                <span className="nav-user-login">
                  {session?.user.login ?? "user"}
                </span>

                {session?.subscription.plan && (
                  <span className="nav-user-plan-badge">
                    {session.subscription.plan}
                  </span>
                )}

                {/* Status LED */}
                <span className="nav-user-status-led" aria-hidden="true" />
              </div>

              {/* Sign out */}
              <Tooltip text={isLoggingOut ? "Signing out…" : "Sign out"}>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  aria-label={isLoggingOut ? "Signing out…" : "Sign out"}
                  className="nav-signout-btn"
                >
                  {isLoggingOut ? (
                    <span className="nav-signout-spinner" aria-hidden="true" />
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
              style={{ padding: "0.38rem 1rem", fontSize: "0.82rem", minHeight: "2.1rem" }}
            >
              Sign up
            </Link>
          )}
        </div>
      </div>

      {/* Gradient underline — transitions in on scroll */}
      <span className={`nav-underline${scrolled ? " nav-underline--visible" : ""}`} aria-hidden="true" />
    </header>
  );
}
