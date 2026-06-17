"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { WorkspaceProvider, useWorkspaceSelection } from "@/components/layout/workspace-context";
import { DeploymentProvidersSection } from "@/components/settings/deployment-providers-section";
import { NotificationPreferencesSection } from "@/components/settings/notification-preferences-section";
import { WorkspaceMembersSection } from "@/components/settings/workspace-members-section";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { logout, deleteAccount, cancelMonthlySubscription, getMyUsage } from "@/lib/api/client";
import type { NotificationsResponse, UsageMeResponse, WorkspacesMeResponse } from "@/lib/api/contracts";
import { getNotifications, markNotificationRead } from "@/lib/api/notifications";
import { getMyWorkspaces } from "@/lib/api/workspaces";
import { isGuest } from "@/lib/auth/subscription";

/* ── Icon components ─────────────────────────────────────────────────────── */

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

function BookOpenIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* ── HoverField ──────────────────────────────────────────────────────────── */

function HoverField({
  label,
  value,
  editable = false,
}: {
  label: string;
  value: string;
  editable?: boolean;
}) {
  return (
    <div className="hover-field">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <span className="hover-field-icon" aria-hidden="true">
          {editable ? <PencilIcon /> : <LockIcon />}
        </span>
      </div>
      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

/* ── Settings section card — flatter, top-accent bar instead of heavy header box ── */

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
    <div
      style={{
        background: danger
          ? "linear-gradient(160deg, rgba(69, 10, 10, 0.8) 0%, rgba(30, 10, 10, 0.5) 100%)"
          : "rgba(15, 23, 42, 0.55)",
        border: danger
          ? "1px solid rgba(220, 38, 38, 0.35)"
          : "1px solid var(--border-soft)",
        borderRadius: "1rem",
        overflow: "hidden",
        transitionDelay: `${index * 40}ms`,
        position: "relative",
      }}
    >
      {/* Top accent line instead of a heavy header block */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: danger
            ? "linear-gradient(90deg, transparent, rgba(248, 113, 113, 0.6), transparent)"
            : "linear-gradient(90deg, transparent, var(--brand), transparent)",
          opacity: 0.5,
        }}
      />

      {/* Section header row — lightweight */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.8rem 1.25rem 0.7rem",
          borderBottom: danger
            ? "1px solid rgba(248, 113, 113, 0.12)"
            : "1px solid var(--border-soft)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.6rem",
            height: "1.6rem",
            borderRadius: "0.35rem",
            background: danger ? "rgba(248, 113, 113, 0.1)" : "var(--surface-brand)",
            color: danger ? "var(--danger)" : "var(--brand)",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: danger ? "var(--danger)" : "var(--text-secondary)",
          }}
        >
          {title}
        </span>
      </div>

      <div className="settings-section-body">
        {children}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

type SettingsSection = "account" | "connections" | "billing" | "guide" | "danger";

const SECTION_LABELS: Record<SettingsSection, string> = {
  account:     "Account",
  connections: "Connections",
  billing:     "Billing",
  guide:       "Guide",
  danger:      "Danger Zone",
};

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const sectionVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18, ease: EASE_OUT } },
};

function SettingsPageContent() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const { workspacesEnabled, notificationsEnabled } = useCapabilities();
  const { selectedWorkspace, setWorkspaces: setWorkspaceContext } = useWorkspaceSelection();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");

  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [usage, setUsage] = useState<UsageMeResponse | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspacesMeResponse | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed-out") {
      router.push("/login?next=/settings");
    }
  }, [status, router]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const updateLayout = () => setIsCompactLayout(media.matches);
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (activeSection !== "billing") return;
    let active = true;
    void getMyUsage()
      .then((response) => {
        if (active) {
          setUsage(response);
          setUsageError(null);
        }
      })
      .catch(() => {
        if (active) {
          setUsageError("Usage limits are unavailable right now.");
        }
      });
    return () => {
      active = false;
    };
  }, [activeSection]);

  useEffect(() => {
    if (!["account", "billing"].includes(activeSection) || !workspacesEnabled) return;
    let active = true;
    void getMyWorkspaces()
      .then((response) => {
        if (active) {
          setWorkspaces(response);
          setWorkspaceContext(response);
          setWorkspacesError(null);
        }
      })
      .catch(() => {
        if (active) {
          setWorkspacesError("Workspaces are unavailable right now.");
        }
      });
    return () => {
      active = false;
    };
  }, [activeSection, setWorkspaceContext, workspacesEnabled]);

  useEffect(() => {
    if (activeSection !== "account" || !notificationsEnabled) return;
    let active = true;
    void getNotifications()
      .then((response) => {
        if (active) {
          setNotifications(response);
          setNotificationsError(null);
        }
      })
      .catch(() => {
        if (active) {
          setNotificationsError("Notifications are unavailable right now.");
        }
      });
    return () => {
      active = false;
    };
  }, [activeSection, notificationsEnabled]);

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

  async function handleCancelSubscription() {
    if (selectedWorkspaceRole !== "owner" && selectedWorkspaceRole !== "admin") {
      setCancelMessage("Billing management requires owner or admin workspace access.");
      return;
    }

    setIsCanceling(true);
    setCancelMessage(null);
    try {
      await cancelMonthlySubscription();
      await refresh();
      setCancelMessage("Your subscription has been canceled.");
      setShowCancelConfirm(false);
    } catch {
      setCancelMessage("Failed to cancel subscription. Please try again.");
    } finally {
      setIsCanceling(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    setDeleteMessage(null);
    try {
      await deleteAccount();
      router.push("/");
    } catch {
      setDeleteMessage("Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  }

  async function handleMarkNotificationRead(id: string) {
    setMarkingNotificationId(id);
    setNotificationsError(null);
    try {
      await markNotificationRead(id);
      setNotifications((current) =>
        current
          ? {
              ...current,
              unreadCount: Math.max(0, current.unreadCount - 1),
              items: current.items.map((item) =>
                item.id === id
                  ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                  : item,
              ),
            }
          : current,
      );
    } catch {
      setNotificationsError("Notification update failed.");
    } finally {
      setMarkingNotificationId(null);
    }
  }

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (status === "loading") {
    return <PipelineLoader label="Loading settings" />;
  }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
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
  const selectedWorkspaceRole = selectedWorkspace?.role ?? workspaces?.items[0]?.role ?? null;
  const canManageBilling = selectedWorkspaceRole === "owner" || selectedWorkspaceRole === "admin";

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
        className="settings-layout"
        id="main-content"
        style={{
          padding: isCompactLayout ? "1rem" : "1.75rem var(--layout-gutter) 2.5rem",
          flex: 1,
          display: "flex",
          flexDirection: isCompactLayout ? "column" : "row",
          gap: "1.75rem",
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        {/* ── Left sidebar nav ── */}
        <nav
          className="settings-sidebar"
          aria-label="Settings sections"
          style={{
            width: isCompactLayout ? "100%" : "220px",
            flexShrink: 0,
            position: isCompactLayout ? "relative" : "sticky",
            top: isCompactLayout ? "auto" : "72px",
            alignSelf: "flex-start",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            background: "rgba(15, 23, 42, 0.55)",
            border: "1px solid var(--border-soft)",
            borderRadius: "1rem",
            padding: "1rem",
          }}
        >
          {/* Mini profile summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              paddingBottom: "0.85rem",
              marginBottom: "0.5rem",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: "50%",
                padding: "1.5px",
                background: "linear-gradient(135deg, var(--brand), var(--accent-violet))",
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
                <span className="dash-badge-violet">
                  {session.subscription.plan}
                </span>
              )}
            </div>
          </div>

          {/* Section nav buttons */}
          {(["account", "connections", "billing", "guide", "danger"] as SettingsSection[]).map((sec) => {
            const isActive = activeSection === sec;
            const isDanger = sec === "danger";
            const icons: Record<SettingsSection, React.ReactNode> = {
              account:     <UserIcon size={14} />,
              connections: <GithubIcon size={14} />,
              billing:     <CreditCardIcon size={14} />,
              guide:       <BookOpenIcon size={14} />,
              danger:      <AlertTriangleIcon size={14} />,
            };
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setActiveSection(sec)}
                aria-current={isActive ? "true" : undefined}
                className="settings-nav-btn"
                style={{
                  border: isActive
                    ? isDanger ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(56,189,248,0.25)"
                    : "1px solid transparent",
                  background: isActive
                    ? isDanger ? "rgba(248,113,113,0.08)" : "rgba(56,189,248,0.09)"
                    : "transparent",
                  color: isActive
                    ? isDanger ? "var(--danger)" : "var(--brand)"
                    : isDanger ? "rgba(248,113,113,0.65)" : "var(--text-secondary)",
                }}
              >
                {icons[sec]}
                {SECTION_LABELS[sec]}
              </button>
            );
          })}
        </nav>

        {/* ── Right content ── */}
        <div
          className="settings-content"
          style={{
            flex: 1,
            minWidth: 0,
            width: isCompactLayout ? "100%" : undefined,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              variants={prefersReducedMotion ? undefined : sectionVariants}
              initial={prefersReducedMotion ? false : "hidden"}
              animate="visible"
              exit="exit"
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >

              {/* ── Account section ── */}
              {activeSection === "account" && (
                <>
                  {/* Profile header — flat with gradient accent */}
                  <motion.div
                    initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}
                    style={{
                      position: "relative",
                      borderRadius: "1rem",
                      overflow: "hidden",
                      background: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid var(--border-soft)",
                      padding: "clamp(1.25rem, 3vw, 1.75rem)",
                    }}
                  >
                    {/* Gradient top bar — brand + violet */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0,
                        height: 2,
                        background: "linear-gradient(90deg, var(--brand), var(--accent-violet))",
                      }}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
                      {/* Avatar with gradient ring — brand to violet */}
                      <div
                        style={{
                          position: "relative",
                          borderRadius: "50%",
                          padding: "2.5px",
                          background: "linear-gradient(135deg, var(--brand), var(--accent-violet))",
                          flexShrink: 0,
                        }}
                      >
                        {session?.user.avatarUrl ? (
                          <Image
                            src={session.user.avatarUrl}
                            alt={session.user.name ?? session.user.login}
                            width={64}
                            height={64}
                            style={{ borderRadius: "50%", display: "block", border: "2px solid var(--bg-base)" }}
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
                        <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--brand)", margin: "0 0 0.25rem" }}>
                          SETTINGS / ACCOUNT
                        </p>
                        <h1 style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 800, margin: "0 0 0.2rem", letterSpacing: "-0.02em" }}>
                          {session?.user.name ?? session?.user.login ?? "Your account"}
                        </h1>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                          {session?.user.login && (
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace" }}>
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
                            <span className="dash-badge-violet">
                              {session.subscription.plan} plan
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Account identity */}
                  <SettingsSection icon={<UserIcon />} title="Account" index={0}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <HoverField label="Display name" value={session?.user.name ?? "—"} editable={false} />
                        <HoverField label="GitHub login" value={`@${session?.user.login ?? "—"}`} editable={false} />
                      </div>
                      {session?.user.email ? (
                        <HoverField label="Email" value={session.user.email} editable={false} />
                      ) : null}
                    </div>
                  </SettingsSection>
                  {workspacesEnabled ? (
                    <SettingsSection icon={<UserIcon />} title="Workspace" index={1}>
                      {workspacesError ? (
                        <p className="error-text" style={{ margin: 0 }}>{workspacesError}</p>
                      ) : workspaces?.items.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {workspaces.items.map((workspace) => (
                            <div key={workspace.id} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                              <div
                                className="hover-field"
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}
                              >
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                  {workspace.name}
                                </span>
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                                  {workspace.kind} / {workspace.role}
                                </span>
                              </div>
                              </div>
                              <WorkspaceMembersSection
                                workspace={workspace}
                                currentUserId={session?.user.id ?? ""}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Loading workspace...
                        </p>
                      )}
                    </SettingsSection>
                  ) : null}

                  {notificationsEnabled ? (
                    <SettingsSection icon={<AlertTriangleIcon />} title="Notifications" index={2}>
                      {notificationsError ? (
                        <p className="error-text" style={{ margin: 0 }}>{notificationsError}</p>
                      ) : notifications ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {notifications.unreadCount} unread
                          </span>
                          {notifications.items.length ? (
                            notifications.items.map((notification) => (
                              <div
                                key={notification.id}
                                className="hover-field"
                                style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}
                              >
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxWidth: "min(100%, 560px)" }}>
                                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                    {notification.title}
                                  </span>
                                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                    {notification.body}
                                  </span>
                                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
                                    {notification.eventCode}
                                  </span>
                                </div>
                                {notification.readAt ? (
                                  <span className="dash-badge-violet">Read</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="dash-action-btn"
                                    disabled={markingNotificationId === notification.id}
                                    onClick={() => void handleMarkNotificationRead(notification.id)}
                                  >
                                    {markingNotificationId === notification.id ? "Saving..." : "Mark read"}
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              No notifications.
                            </p>
                          )}
                          <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
                            <NotificationPreferencesSection />
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Loading notifications...
                        </p>
                      )}
                    </SettingsSection>
                  ) : null}
                </>
              )}

              {/* ── Connections section ── */}
              {activeSection === "connections" && (
                <SettingsSection icon={<GithubIcon />} title="GitHub Connection" index={0}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className="dash-status-active" />
                        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          GitHub App connected
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        Manage your GitHub App connection from the Create Project page.
                      </p>
                    </div>
                    <Link href="/workflows" className="dash-action-btn">
                      Manage
                      <ExternalLinkIcon size={11} />
                    </Link>
                  </div>
                </SettingsSection>
              )}

              {/* ── Billing section ── */}
              {activeSection === "billing" && (
                <>
                  <SettingsSection icon={<CreditCardIcon />} title="Billing" index={0}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {/* Current plan row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {session?.subscription.plan
                              ? `${session.subscription.plan.charAt(0).toUpperCase() + session.subscription.plan.slice(1)} plan`
                              : "No active plan"}
                          </span>
                          {session?.subscription.status && (
                            <span style={{ fontSize: "0.78rem", color: session.subscription.status === "active" ? "var(--success)" : "var(--text-muted)", textTransform: "capitalize" }}>
                              Status: {session.subscription.status}
                            </span>
                          )}
                        </div>
                        <Link
                          href={canManageBilling ? "/subscribe" : "#"}
                          className="dash-action-btn"
                          aria-disabled={!canManageBilling}
                          onClick={(event) => {
                            if (!canManageBilling) event.preventDefault();
                          }}
                        >
                          View plan
                          <ExternalLinkIcon size={11} />
                        </Link>
                      </div>
                      {!canManageBilling ? (
                        <p className="helper-text" style={{ margin: 0 }}>
                          Billing management requires owner or admin workspace access.
                        </p>
                      ) : null}

                      {/* Cancel subscription */}
                      {session?.subscription.plan === "pro" && session.subscription.status === "active" && (
                        <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                          {!showCancelConfirm ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>Cancel subscription</span>
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Your access will remain active until the end of the billing period.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowCancelConfirm(true)}
                                disabled={!canManageBilling}
                                className="confirm-btn-danger"
                                style={{ padding: "0.4rem 0.85rem", fontSize: "0.82rem" }}
                              >
                                Cancel plan
                              </button>
                            </div>
                          ) : (
                            <div style={{ background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.18)", borderRadius: "0.75rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                                Are you sure you want to cancel your Pro subscription?
                              </p>
                              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                You will lose access to Pro features at the end of your current billing period. This action can be undone by resubscribing.
                              </p>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button type="button" onClick={() => void handleCancelSubscription()} disabled={isCanceling || !canManageBilling} className="confirm-btn-danger">
                                  {isCanceling ? "Canceling..." : "Yes, cancel"}
                                </button>
                                <button type="button" onClick={() => { setShowCancelConfirm(false); setCancelMessage(null); }} disabled={isCanceling} className="confirm-btn-neutral">
                                  Keep plan
                                </button>
                              </div>
                            </div>
                          )}
                          {cancelMessage && (
                            <p style={{ margin: 0, fontSize: "0.8rem", color: cancelMessage.startsWith("Failed") ? "var(--danger)" : "var(--success)" }}>
                              {cancelMessage}
                            </p>
                          )}
                        </div>
                      )}
                      <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          Usage
                        </span>
                        {usageError ? (
                          <p className="error-text" style={{ margin: 0 }}>{usageError}</p>
                        ) : usage ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem" }}>
                            {usage.items.map((item) => (
                              <div key={item.code} className="hover-field">
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                  {item.code.replaceAll("_", " ")}
                                </span>
                                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: item.upgradeRequired ? "var(--danger)" : "var(--text-primary)" }}>
                                  {item.current} / {item.limit}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Loading usage...
                          </p>
                        )}
                      </div>
                    </div>
                  </SettingsSection>
                  <DeploymentProvidersSection workspaceRole={selectedWorkspaceRole} />
                </>
              )}

              {/* ── Guide section ── */}
              {activeSection === "guide" && (
                <SettingsSection icon={<BookOpenIcon />} title="Guide" index={0}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      AlphaCI turns a blank idea into a working repository in one step — GitHub repo, protected branches, and a ready-to-run CI/CD pipeline, all committed automatically.
                    </p>

                    {/* Topic overview */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        What is covered
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {[
                          "Getting started — sign in, install the GitHub App",
                          "Creating a project — repo shapes, framework, recipe",
                          "Branch strategy — test → uat → main promotion flow",
                          "CI/CD quality gates — lint, tests, security, E2E",
                          "Managing projects — current projects and catalog",
                          "FAQ and troubleshooting",
                        ].map((topic) => (
                          <div
                            key={topic}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "0.55rem",
                              fontSize: "0.84rem",
                              color: "var(--text-secondary)",
                              lineHeight: 1.45,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: "5px",
                                height: "5px",
                                borderRadius: "50%",
                                background: "var(--brand)",
                                marginTop: "0.45em",
                                flexShrink: 0,
                              }}
                            />
                            {topic}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action row */}
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", paddingTop: "0.25rem", borderTop: "1px solid var(--border-soft)" }}>
                      <Link
                        href="/guide"
                        className="primary-button"
                        style={{ fontSize: "0.82rem", padding: "0.45rem 1.1rem" }}
                      >
                        Open full guide
                      </Link>
                      <Link
                        href="/workflows?tour=1"
                        className="ghost-button"
                        style={{ fontSize: "0.82rem", padding: "0.45rem 1.1rem" }}
                        aria-label="Replay the guided product tour on the Workflows Setup tab"
                      >
                        Replay guided tour
                      </Link>
                    </div>
                  </div>
                </SettingsSection>
              )}

              {/* ── Danger Zone section ── */}
              {activeSection === "danger" && (
                <SettingsSection icon={<AlertTriangleIcon />} title="Danger Zone" index={0} danger>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                    {/* Sign out */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          Sign out of AlphaCI
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Your session will be terminated and you will be redirected to the home page.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={isLoggingOut}
                        className="confirm-btn-danger"
                        style={{ padding: "0.4rem 0.85rem", fontSize: "0.82rem", flexShrink: 0, cursor: isLoggingOut ? "not-allowed" : "pointer", opacity: isLoggingOut ? 0.6 : 1 }}
                      >
                        {isLoggingOut ? "Signing out..." : "Sign out"}
                      </button>
                    </div>
                    {logoutMessage && (
                      <p className="error-text" style={{ marginTop: "-0.5rem" }}>{logoutMessage}</p>
                    )}

                    <div style={{ borderTop: "1px solid rgba(248, 113, 113, 0.12)" }} />

                    {/* Archive account */}
                    {!showDeleteConfirm ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            Archive your account
                          </span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Your account and data are archived for 30 days. You can restore everything by signing in again within that window.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowDeleteConfirm(true); setDeleteMessage(null); setDeleteConfirmInput(""); }}
                          className="confirm-btn-danger"
                          style={{ padding: "0.4rem 0.85rem", fontSize: "0.82rem", flexShrink: 0 }}
                        >
                          Archive my account
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.2)", borderRadius: "0.75rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--danger)" }}>
                            This will archive your account.
                          </p>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Your account and all associated data will be archived — not immediately deleted. You can sign in with GitHub within{" "}
                            <strong style={{ color: "var(--text-secondary)" }}>30 days</strong> to fully restore your account. After 30 days the archived account is permanently deleted.
                          </p>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            <strong style={{ color: "var(--text-secondary)" }}>Your GitHub repositories and any workflow files committed to them are not affected</strong> — they remain on GitHub regardless of what you choose here.
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <label htmlFor="delete-confirm-input" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            Type your username{" "}
                            <strong style={{ color: "var(--text-primary)", fontFamily: "ui-monospace, monospace" }}>
                              {session?.user.login}
                            </strong>
                            {" "}to confirm:
                          </label>
                          <input
                            id="delete-confirm-input"
                            type="text"
                            value={deleteConfirmInput}
                            onChange={(e) => setDeleteConfirmInput(e.target.value)}
                            placeholder={session?.user.login ?? "username"}
                            autoComplete="off"
                            style={{
                              background: "rgba(15, 23, 42, 0.6)",
                              border: "1px solid rgba(248, 113, 113, 0.3)",
                              borderRadius: "0.5rem",
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.85rem",
                              color: "var(--text-primary)",
                              fontFamily: "ui-monospace, monospace",
                              outline: "none",
                              width: "100%",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAccount()}
                            disabled={isDeleting || deleteConfirmInput !== session?.user.login}
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "#fff",
                              padding: "0.45rem 1rem",
                              borderRadius: "0.5rem",
                              border: "1px solid rgba(248, 113, 113, 0.6)",
                              background: isDeleting || deleteConfirmInput !== session?.user.login ? "rgba(248, 113, 113, 0.2)" : "rgba(248, 113, 113, 0.7)",
                              cursor: isDeleting || deleteConfirmInput !== session?.user.login ? "not-allowed" : "pointer",
                              opacity: isDeleting ? 0.6 : 1,
                              transition: "all 0.2s ease",
                            }}
                          >
                            {isDeleting ? "Archiving..." : "Archive my account"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowDeleteConfirm(false); setDeleteMessage(null); setDeleteConfirmInput(""); }}
                            disabled={isDeleting}
                            className="confirm-btn-neutral"
                            style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                        {deleteMessage && (
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--danger)" }}>{deleteMessage}</p>
                        )}
                      </div>
                    )}

                  </div>
                </SettingsSection>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <WorkspaceProvider>
      <SettingsPageContent />
    </WorkspaceProvider>
  );
}
