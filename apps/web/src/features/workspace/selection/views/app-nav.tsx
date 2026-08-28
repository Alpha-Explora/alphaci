"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { AuthSession } from "@/features/auth/session";

import {
  APP_ROLE_BADGE_LABELS,
  type WorkspaceAppRole,
} from "../model/workspace-types";
import { useAppNavViewModel } from "../view-models/use-app-nav-view-model";
import { WorkspaceSwitcher } from "./workspace-switcher";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AppNavProps {
  guest: boolean;
  session: AuthSession | null;
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

function TeamsIcon({ size = 16 }: { size?: number }) {
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
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InboxIcon({ size = 16 }: { size?: number }) {
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
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
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

/* ── Sidebar nav item ───────────────────────────────────────────────────────── */

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactNode;
  isActive: boolean;
  reduced: boolean;
  badgeCount?: number;
  /** Suppresses hover-expand for the rest of this pointer pass. */
  onNavigate: () => void;
}

/**
 * The label is ALWAYS rendered and hidden with opacity, never unmounted or
 * `display:none`. Two reasons: a screen reader then reads the nav normally
 * whatever the visual state, and expanding the rail reveals text that is
 * already laid out instead of reflowing the rail's contents as it opens.
 *
 * `.app-sidebar` clips overflow, which is what turns that from truncation into
 * a reveal — without it the 200px-wide invisible labels raise a horizontal
 * scrollbar inside a 64px rail.
 */
function SidebarNavItem({
  href,
  label,
  icon: NavIcon,
  isActive,
  reduced,
  badgeCount = 0,
  onNavigate,
}: Readonly<SidebarNavItemProps>) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
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
      <span className="sidebar-nav-item-icon">
        <NavIcon size={16} />
      </span>
      <span className="sidebar-nav-item-label">{label}</span>
      {badgeCount > 0 ? (
        <>
          {/* Two presentations of one number: a bare dot that survives the
              64px rail, and the real count once the labels are readable. */}
          <span className="sidebar-nav-dot" aria-hidden="true" />
          <span
            className="sidebar-nav-count"
            aria-label={`${badgeCount} unread`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        </>
      ) : null}
    </Link>
  );
}

/* ── Role badge ─────────────────────────────────────────────────────────────
   Answers "which am I?" at a glance. The label mirrors the GitHub org team
   that drives the role (`team-lead` → Team lead, `developers` → Developer), so
   what a user sees here matches what they were added to in GitHub. Hidden when
   the rail is closed — 64px has no room for it, and the role is not urgent
   enough to earn an icon-only affordance. */

function SidebarRoleBadge({ appRole }: Readonly<{ appRole: WorkspaceAppRole }>) {
  return (
    <span className={`sidebar-role-badge sidebar-role-badge--${appRole}`}>
      {APP_ROLE_BADGE_LABELS[appRole]}
    </span>
  );
}

/* ── Section divider label ──────────────────────────────────────────────────── */

/**
 * Renders both forms at once and lets CSS choose: a hairline rule while the
 * rail is closed, the words once it opens. Swapping them in JS would mean the
 * rail re-flowed mid-transition.
 */
function SidebarSectionLabel({ text }: { text: string }) {
  return (
    <div className="sidebar-section" aria-hidden="true">
      <span className="sidebar-section-divider" />
      <span className="sidebar-section-label">{text}</span>
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
  const { pathname, workspaces: workspaceVm, notifications } =
    useAppNavViewModel({ guest });
  // Cleared on pointerleave. Clicking a nav link navigates but does NOT move
  // the mouse, so the rail stays hovered — and an expanded rail is 240px of
  // panel sitting on top of the page you just asked for. Suppressing hover
  // until the pointer leaves makes a click read as "take me there", not "take
  // me there and stay in the way". Keyboard focus is never suppressed.
  const [hoverSuppressed, setHoverSuppressed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();
  // The Admin tab is the GLOBAL admin tier: app_role 'admin' or the permanent
  // super-admin. Leads and members don't see it. Mirrors the BE guard.
  const isPlatformAdmin =
    !guest &&
    (session?.appRole === "admin" || session?.platformRole === "super_admin");
  // Defaults to 'member' (rendered as "Developer") so the badge never blanks
  // out on an older cached session that predates appRole.
  const appRole: WorkspaceAppRole = session?.appRole ?? "member";
  const loadWorkspaces = workspaceVm.loadWorkspaces;

  return (
    <>
      {/* The rail's width is a CSS hover state, not React state. It is `fixed`
          and the page reserves only the COLLAPSED width via --sidebar-width, so
          expanding paints over the content instead of reflowing it — these
          pages are dashboards and tables, and re-laying one out on every
          incidental mouse pass along the left edge is motion nobody asked for.

          pointerleave rather than mouseleave: it also fires for pen and touch,
          so a tablet cannot strand the rail in the suppressed state. */}
      {/* ── The one header ──────────────────────────────────────────────────
          Everything that must stay readable regardless of the rail's state:
          the workspace switcher (the one control up here that CHANGES state,
          so it cannot live behind a hover), identity, and sign-out.

          It starts to the right of the closed rail rather than spanning the
          full width, so the rail keeps its own brand mark and the expanded
          rail paints over this bar rather than beside it. */}
      <header className="app-header">
        <div className="app-header-left">
          <Link
            href="/home"
            className="app-header-brand"
            aria-label="ALPHACI — home"
          >
            <Image
              src="/brand-logo.png"
              alt="ALPHACI"
              width={138}
              height={46}
              unoptimized
              priority
              className="app-header-brand-image"
            />
          </Link>
          {/* Teams live here rather than in the rail: picking one changes what
              the rest of the app is scoped to, which is a header job. */}
          {!guest && (
            <WorkspaceSwitcher
              workspaces={workspaceVm.workspaces}
              appRole={appRole}
              status={workspaceVm.status}
              onRetry={loadWorkspaces}
              onWorkspaceCreated={loadWorkspaces}
            />
          )}
        </div>

        <div className="app-header-right">
          {guest ? (
            <>
              <Link className="ghost-button app-header-btn" href="/login">
                Log in
              </Link>
              <Link className="primary-button app-header-btn" href="/signup">
                Sign up
              </Link>
            </>
          ) : (
            <>
              <div className="app-header-identity">
                <span className="app-header-login">
                  {session?.user.login ?? "user"}
                </span>
                <SidebarRoleBadge appRole={appRole} />
              </div>

              <span className="app-header-avatar-ring">
                {session?.user.avatarUrl ? (
                  <Image
                    src={session.user.avatarUrl}
                    alt={session.user.name ?? session.user.login}
                    width={32}
                    height={32}
                    className="app-header-avatar"
                    unoptimized
                  />
                ) : (
                  <span className="app-header-avatar-fallback" aria-hidden="true">
                    {avatarInitial}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                className="app-header-signout"
              >
                {isLoggingOut ? (
                  <span className="sidebar-signout-spinner" aria-hidden="true" />
                ) : (
                  <SignOutIcon size={14} />
                )}
                <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </>
          )}
        </div>
      </header>

      <aside
        className="app-sidebar"
        data-hover-suppressed={hoverSuppressed ? "true" : "false"}
        onPointerLeave={() => setHoverSuppressed(false)}
        aria-label="Primary navigation"
      >
        <div className="sidebar-edge-gradient" aria-hidden="true" />

        {/* ── Primary nav ───────────────────────────────────────── */}
        <nav className="sidebar-nav" aria-label="Primary">
          <SidebarSectionLabel text="Main" />

          <SidebarNavItem
            href="/home"
            label="Home"
            icon={DashboardIcon}
            isActive={pathname === "/home"}
            reduced={reduced}
            onNavigate={() => setHoverSuppressed(true)}
          />
          {/*
            "Projects" points at /workflows, and that mismatch is now the ONLY
            one left: the second bar used to be labelled "Workflows" while
            pointing at /runs, so the two names read in the opposite order to
            their routes. Pipeline runs live inside a project now, so that bar
            is gone and the confusion goes with it. /runs survives as the
            cross-project view — the one question a per-project tab cannot
            answer — reached from Home rather than from here.
          */}
          <SidebarNavItem
            href="/workflows"
            label="Projects"
            icon={WorkflowsIcon}
            isActive={pathname === "/workflows"}
            reduced={reduced}
            onNavigate={() => setHoverSuppressed(true)}
          />

          {/* The header picks the WORKSPACE; this lists the teams inside it.
              Selection is a header job, browsing is a nav job. */}
          {!guest && (
            <SidebarNavItem
              href="/teams"
              label="Teams"
              icon={TeamsIcon}
              isActive={pathname === "/teams" || pathname.startsWith("/groups")}
              reduced={reduced}
              onNavigate={() => setHoverSuppressed(true)}
            />
          )}
          {!guest && (
            <SidebarNavItem
              href="/inbox"
              label="Inbox"
              icon={InboxIcon}
              isActive={pathname === "/inbox"}
              reduced={reduced}
              onNavigate={() => setHoverSuppressed(true)}
              badgeCount={notifications.unreadCount}
            />
          )}

          <SidebarSectionLabel text="Account" />

          {!guest && (
            <SidebarNavItem
              href="/settings"
              label="Settings"
              icon={SettingsIcon}
              isActive={pathname === "/settings"}
              reduced={reduced}
              onNavigate={() => setHoverSuppressed(true)}
            />
          )}

          {isPlatformAdmin && (
            <SidebarNavItem
              href="/admin"
              label="Admin"
              icon={AdminIcon}
              isActive={pathname.startsWith("/admin")}
              reduced={reduced}
              onNavigate={() => setHoverSuppressed(true)}
            />
          )}
        </nav>

      </aside>
    </>
  );
}
