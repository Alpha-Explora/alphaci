"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import type { useAuthSession } from "@/hooks/use-auth-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import type {
  NotificationsResponse,
  WorkspacesMeResponse,
} from "@/lib/api/contracts";
import {
  getNotifications,
  markNotificationRead,
} from "@/lib/api/notifications";
import { getMyWorkspaces } from "@/lib/api/workspaces";
import { NotificationCenter } from "./notification-center";
import { useWorkspaceSelection } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AppNavProps {
  guest: boolean;
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
}

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function DashboardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function WorkflowsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function RunsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" />
    </svg>
  );
}

function GroupsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49" />
    </svg>
  );
}

function AdminIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function SignOutIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/* ── Tooltip — appears to the right of the icon when sidebar is collapsed ─── */

function SidebarTooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "flex", width: "100%" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.92 }}
            transition={{ duration: 0.14 }}
            style={{
              position: "absolute",
              left: "calc(100% + 10px)",
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: "0.45rem",
              padding: "0.35rem 0.7rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              pointerEvents: "none",
              zIndex: 300,
              boxShadow: "var(--shadow-card)",
            }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sidebar nav item ───────────────────────────────────────────────────────── */

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactNode;
  isActive: boolean;
  collapsed: boolean;
  reduced: boolean;
  itemIndex?: number;
}

function SidebarNavItem({
  href,
  label,
  icon: NavIcon,
  isActive,
  collapsed,
  reduced,
  itemIndex = 0,
}: Readonly<SidebarNavItemProps>) {
  const expandDelay = itemIndex * 0.04;
  const collapseDelay = itemIndex * 0.018;

  const inner = (
    <motion.div
      className="sidebar-nav-item-wrapper"
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      whileHover={reduced ? undefined : { x: 2 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
    >
      <Link
        href={href}
        className={`sidebar-nav-item${isActive ? " sidebar-nav-item--active" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-active-pill"
            className="sidebar-nav-item-bg"
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 36 }
            }
            aria-hidden="true"
          />
        )}
        <motion.span
          className="sidebar-nav-item-icon"
          animate={
            isActive
              ? { color: "var(--accent-indigo)" }
              : { color: "var(--text-secondary)" }
          }
          whileHover={reduced ? undefined : { scale: 1.12 }}
          transition={{ duration: 0.2 }}
        >
          <NavIcon size={16} />
        </motion.span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              className="sidebar-nav-item-label"
              initial={reduced ? false : { opacity: 0, x: -10, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={reduced ? undefined : { opacity: 0, x: -6, width: 0 }}
              transition={{
                duration: 0.2,
                ease: [0.25, 0, 0, 1],
                delay: collapsed ? collapseDelay : expandDelay,
              }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    </motion.div>
  );

  if (collapsed) {
    return <SidebarTooltip text={label}>{inner}</SidebarTooltip>;
  }

  return inner;
}

/* ── Section divider label ──────────────────────────────────────────────────── */

function SidebarSectionLabel({
  text,
  collapsed,
}: {
  text: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="sidebar-section-divider" aria-hidden="true" />;
  }
  return (
    <div className="sidebar-section-label" aria-hidden="true">
      {text}
    </div>
  );
}

/* ── AppNav (sidebar) ───────────────────────────────────────────────────────── */

export function AppNav({
  guest,
  session,
  onLogout,
  isLoggingOut,
}: Readonly<AppNavProps>) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspacesState] =
    useState<WorkspacesMeResponse | null>(null);
  const [notifications, setNotifications] =
    useState<NotificationsResponse | null>(null);
  const { setWorkspaces } = useWorkspaceSelection();
  const { hierarchyEnabled } = useCapabilities();
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;
  const sidebarRef = useRef<HTMLElement>(null);

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();
  // The Admin tab is the GLOBAL admin tier: app_role 'admin' or the permanent
  // super-admin. Leads and members don't see it. Mirrors the BE guard.
  const isPlatformAdmin =
    !guest &&
    (session?.appRole === "admin" || session?.platformRole === "super_admin");

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 768) {
        setCollapsed(true);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "64px" : "220px",
    );
  }, [collapsed]);

  useEffect(() => {
    if (guest) return;
    let active = true;
    void getMyWorkspaces()
      .then((response) => {
        if (!active) return;
        setWorkspacesState(response);
        setWorkspaces(response);
      })
      .catch(() => {
        if (!active) return;
        setWorkspacesState({ enabled: false, items: [] });
        setWorkspaces(null);
      });
    return () => {
      active = false;
    };
  }, [guest, setWorkspaces]);

  useEffect(() => {
    if (guest) return;
    let active = true;
    void getNotifications()
      .then((response) => {
        if (active) setNotifications(response);
      })
      .catch(() => {
        if (active)
          setNotifications({ enabled: false, items: [], unreadCount: 0 });
      });
    return () => {
      active = false;
    };
  }, [guest]);

  async function handleMarkNotificationRead(id: string) {
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
  }

  const sidebarWidth = collapsed ? 64 : 220;

  return (
    <>
      <motion.aside
        ref={sidebarRef}
        className="app-sidebar"
        data-collapsed={collapsed ? "true" : "false"}
        animate={{ width: sidebarWidth }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 360, damping: 34, mass: 0.8 }
        }
        style={{ width: sidebarWidth }}
        aria-label="Primary navigation"
      >
        <div className="sidebar-edge-gradient" aria-hidden="true" />

        {/* ── Brand zone ────────────────────────────────────────── */}
        <div className="sidebar-brand-zone">
          <Link
            href="/home"
            className="sidebar-brand-link"
            aria-label="ALPHACI — home"
          >
            <Image
              src="/brand-logo.png"
              alt="ALPHACI"
              width={138}
              height={46}
              unoptimized
              priority
              className="sidebar-brand-image"
              style={{
                display: "block",
                height: 46,
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />
          </Link>
        </div>

        {/* ── Primary nav ───────────────────────────────────────── */}
        <nav className="sidebar-nav" aria-label="Primary">
          {!guest && (
            <div style={{ padding: collapsed ? "0 0.5rem 0.75rem" : "0 0.75rem 0.75rem" }}>
              <div
                className="sidebar-user-chip"
                aria-label={`Signed in as ${session?.user.login ?? "user"}`}
              >
                <span className="sidebar-user-avatar-ring">
                  {session?.user.avatarUrl ? (
                    <Image
                      src={session.user.avatarUrl}
                      alt={session.user.name ?? session.user.login}
                      width={28}
                      height={28}
                      className="sidebar-user-avatar-img"
                      unoptimized
                    />
                  ) : (
                    <span
                      className="sidebar-user-avatar-fallback"
                      aria-hidden="true"
                    >
                      {avatarInitial}
                    </span>
                  )}
                </span>

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      className="sidebar-user-info"
                      initial={reduced ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduced ? undefined : { opacity: 0, x: -8 }}
                      transition={{ duration: 0.16 }}
                    >
                      <span className="sidebar-user-login">
                        {session?.user.login ?? "user"}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="sidebar-utility-actions">
                  <NotificationCenter
                    notifications={notifications}
                    onMarkRead={handleMarkNotificationRead}
                  />
                </div>
              </div>
            </div>
          )}

          <SidebarSectionLabel text="Main" collapsed={collapsed} />

          <SidebarNavItem
            href="/home"
            label="Home"
            icon={DashboardIcon}
            isActive={pathname === "/home"}
            collapsed={collapsed}
            reduced={reduced}
            itemIndex={0}
          />
          <SidebarNavItem
            href="/workflows"
            label="Projects"
            icon={WorkflowsIcon}
            isActive={pathname === "/workflows"}
            collapsed={collapsed}
            reduced={reduced}
            itemIndex={1}
          />
          <SidebarNavItem
            href="/runs"
            label="Workflows"
            icon={RunsIcon}
            isActive={pathname === "/runs"}
            collapsed={collapsed}
            reduced={reduced}
            itemIndex={2}
          />
          {!guest && hierarchyEnabled && (
            <SidebarNavItem
              href="/groups"
              label="Groups"
              icon={GroupsIcon}
              isActive={pathname.startsWith("/groups")}
              collapsed={collapsed}
              reduced={reduced}
              itemIndex={3}
            />
          )}

          <SidebarSectionLabel text="Account" collapsed={collapsed} />

          {!guest && (
            <SidebarNavItem
              href="/settings"
              label="Settings"
              icon={SettingsIcon}
              isActive={pathname === "/settings"}
              collapsed={collapsed}
              reduced={reduced}
              itemIndex={3}
            />
          )}

          {isPlatformAdmin && (
            <SidebarNavItem
              href="/admin"
              label="Admin"
              icon={AdminIcon}
              isActive={pathname.startsWith("/admin")}
              collapsed={collapsed}
              reduced={reduced}
              itemIndex={4}
            />
          )}
        </nav>

        {/* ── Bottom zone — user identity + actions ─────────────── */}
        <div className="sidebar-bottom-zone">
          {!guest && (
            <>
              <div className="sidebar-bottom-utilities">
                <WorkspaceSwitcher workspaces={workspaces} />
              </div>

              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? "Signing out…" : "Sign out"}
                className="sidebar-signout-btn"
              >
                {isLoggingOut ? (
                  <span
                    className="sidebar-signout-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <SignOutIcon size={15} />
                )}
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      initial={reduced ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduced ? undefined : { opacity: 0, x: -8 }}
                      transition={{ duration: 0.16 }}
                      className="sidebar-signout-label"
                    >
                      {isLoggingOut ? "Signing out…" : "Sign out"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </>
          )}

          {guest && (
            <Link
              className="primary-button"
              href="/signup"
              style={{
                width: "100%",
                justifyContent: "center",
                fontSize: "0.82rem",
                padding: "0.5rem 0.75rem",
                minHeight: "2.2rem",
              }}
            >
              {collapsed ? "↑" : "Sign up"}
            </Link>
          )}
        </div>
      </motion.aside>

      <motion.button
        type="button"
        className="sidebar-collapse-btn sidebar-collapse-btn--edge"
        onClick={() => setCollapsed((current) => !current)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        animate={{ left: sidebarWidth - 1 }}
        whileHover={
          reduced
            ? undefined
            : { x: 2, backgroundColor: "rgba(26, 26, 33, 0.98)" }
        }
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 360, damping: 34, mass: 0.8 }
        }
      >
        <motion.span
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 28 }
          }
          className="sidebar-collapse-icon"
        >
          <ChevronLeftIcon size={15} />
        </motion.span>
      </motion.button>
    </>
  );
}
