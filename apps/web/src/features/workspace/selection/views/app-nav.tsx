"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { AuthSession } from "@/features/auth/session";
import { QaAlertToasts } from "@/features/notifications/summary";

import {
  APP_ROLE_BADGE_LABELS,
  isPlatformAdminUser,
  navAvatarInitial,
  reducedMotionEnabled,
  sessionAppRole,
  type SidebarMainItem,
  type WorkspaceAppRole,
} from "../model/workspace-types";
import { useAppNavViewModel } from "../view-models/use-app-nav-view-model";
import { useSidebarPin } from "../view-models/use-sidebar-pin";
import { WorkspaceSwitcher } from "./workspace-switcher";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AppNavProps {
  guest: boolean;
  session: AuthSession | null;
  onLogout: () => void;
  isLoggingOut: boolean;
  /**
   * The team this page belongs to (a project's owning team). The header
   * selects it once it is known and listed; see `useAppNavViewModel`.
   */
  pageWorkspaceId?: string | null;
  /**
   * Called after the viewer picks a DIFFERENT team in the header. A page
   * scoped to one team (a project) passes this to leave for the picked team,
   * since staying would leave the header naming a team the page is not in.
   * Omitted everywhere else, where the pick only rescopes the page.
   */
  onWorkspaceSwitch?: (workspaceId: string) => void;
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

function ChecklistsIcon({ size = 16 }: { size?: number }) {
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
      <path d="M9 11l2 2 4-4" />
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function ActivityIcon({ size = 16 }: { size?: number }) {
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
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
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

/** A panel with its left column; the column fills while the rail is pinned. */
function SidebarPanelIcon({ pinned }: Readonly<{ pinned: boolean }>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      {pinned ? <rect x="3" y="4" width="6" height="16" rx="2" fill="currentColor" stroke="none" opacity="0.35" /> : null}
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
 * scrollbar inside the closed rail.
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
              closed rail, and the real count once the labels are readable. */}
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
   Answers "which am I?" at a glance. The label is the product's persona name
   (APP_ROLE_BADGE_LABELS: Product owner, QA Team, Developer, Admin), not the
   GitHub team behind the role, which users never see. Hidden when
   the rail is closed — it has no room for it, and the role is not urgent
   enough to earn an icon-only affordance. */

function SidebarRoleBadge({ appRole }: Readonly<{ appRole: WorkspaceAppRole }>) {
  return (
    <span className={`sidebar-role-badge sidebar-role-badge--${appRole}`}>
      {APP_ROLE_BADGE_LABELS[appRole]}
    </span>
  );
}

/* ── Section divider ────────────────────────────────────────────────────────── */

/** A hairline between groups, open or closed. The groups need no names. */
function SidebarDivider() {
  return (
    <div className="sidebar-section" aria-hidden="true">
      <span className="sidebar-section-divider" />
    </div>
  );
}

/* ── Pin toggle ─────────────────────────────────────────────────────────────── */

/**
 * The rail's first row: pins it open (the page moves aside) or lets it fold
 * back to opening on hover. Laid out like a nav item, its icon in the same box,
 * so it sits on the rail's midline closed and gains its label open.
 *
 * Icon only: the rail's own width says what it is. One name, pressed or not,
 * so a screen reader hears the state rather than a label that flips under the
 * cursor; the tooltip says what a press will do.
 */
function SidebarPinToggle({ pinned, onToggle }: Readonly<{ pinned: boolean; onToggle: () => void }>) {
  return (
    <div className="sidebar-toggle-row">
      <button
        type="button"
        className="sidebar-nav-item app-sidebar-toggle"
        aria-label="Keep sidebar open"
        aria-pressed={pinned}
        title={pinned ? "Collapse sidebar" : "Keep sidebar open"}
        onClick={onToggle}
      >
        <span className="sidebar-nav-item-icon">
          <SidebarPanelIcon pinned={pinned} />
        </span>
      </button>
      <SidebarDivider />
    </div>
  );
}

/* ── AppNav (sidebar) ───────────────────────────────────────────────────────── */

export function AppNav({
  guest,
  session,
  onLogout,
  isLoggingOut,
  pageWorkspaceId,
  onWorkspaceSwitch,
}: Readonly<AppNavProps>) {
  const isPlatformAdmin = isPlatformAdminUser(guest, session);
  const { pathname, workspaces: workspaceVm, notifications, mainItems } =
    useAppNavViewModel({
      guest,
      isPlatformAdmin,
      appRole: session?.appRole ?? null,
      platformRole: session?.platformRole ?? null,
      pageWorkspaceId,
    });
  // Cleared on pointerleave. Clicking a nav link navigates but does NOT move
  // the mouse, so the rail stays hovered — and an expanded rail is a column of
  // panel sitting on top of the page you just asked for. Suppressing hover
  // until the pointer leaves makes a click read as "take me there", not "take
  // me there and stay in the way". Keyboard focus is never suppressed.
  const [hoverSuppressed, setHoverSuppressed] = useState(false);
  // Pinned, the rail stays open and the page moves aside; unpinned, it still
  // opens on hover. The width itself is CSS, keyed off <html>; see app-shell.css.
  const [sidebarPinned, toggleSidebarPinned] = useSidebarPin();
  const prefersReducedMotion = useReducedMotion();
  const reduced = reducedMotionEnabled(prefersReducedMotion);
  const avatarInitial = navAvatarInitial(session);
  const appRole = sessionAppRole(session);
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
      <AppHeader guest={guest} session={session} appRole={appRole} avatarInitial={avatarInitial}
        workspaces={workspaceVm.workspaces} otherTeams={workspaceVm.otherTeams}
        workspaceStatus={workspaceVm.status}
        loadWorkspaces={loadWorkspaces} onWorkspaceSwitch={onWorkspaceSwitch}
        onLogout={onLogout} isLoggingOut={isLoggingOut} />
      <AppSidebar pathname={pathname} guest={guest} mainItems={mainItems} reduced={reduced}
        isPlatformAdmin={isPlatformAdmin} unreadCount={notifications.unreadCount}
        hoverSuppressed={hoverSuppressed}
        pinned={sidebarPinned}
        onTogglePinned={() => {
          // Unpinning under the cursor would leave the rail open on hover, so
          // the press would seem to do nothing: fold it now, as a nav click does.
          if (sidebarPinned) setHoverSuppressed(true);
          toggleSidebarPinned();
        }}
        onNavigate={() => setHoverSuppressed(true)}
        onPointerLeave={() => setHoverSuppressed(false)} />
      {/* QA's refusals pop up here for the Developers who fix them. */}
      <QaAlertToasts alerts={notifications.alerts} onDismiss={notifications.dismissAlert} />
    </>
  );
}

function AppHeader({ guest, session, appRole, avatarInitial, workspaces, otherTeams, workspaceStatus, loadWorkspaces, onWorkspaceSwitch, onLogout, isLoggingOut }: Readonly<{
  guest: boolean; session: AuthSession | null; appRole: WorkspaceAppRole; avatarInitial: string;
  workspaces: Parameters<typeof WorkspaceSwitcher>[0]["workspaces"];
  otherTeams: NonNullable<Parameters<typeof WorkspaceSwitcher>[0]["otherTeams"]>;
  workspaceStatus: NonNullable<Parameters<typeof WorkspaceSwitcher>[0]["status"]>;
  loadWorkspaces: () => void; onWorkspaceSwitch?: (workspaceId: string) => void;
  onLogout: () => void; isLoggingOut: boolean;
}>) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <Link href="/home" className="app-header-brand" aria-label="ALPHACI — home">
          <Image src="/brand-logo.png" alt="ALPHACI" width={138} height={46} unoptimized priority className="app-header-brand-image" />
        </Link>
        {!guest && (
          <WorkspaceSwitcher
            workspaces={workspaces}
            otherTeams={otherTeams}
            appRole={appRole}
            status={workspaceStatus}
            onRetry={loadWorkspaces}
            onWorkspaceCreated={loadWorkspaces}
            onSwitch={onWorkspaceSwitch}
          />
        )}
      </div>
      <HeaderActions guest={guest} session={session} appRole={appRole} avatarInitial={avatarInitial}
        onLogout={onLogout} isLoggingOut={isLoggingOut} />
    </header>
  );
}

function HeaderActions({ guest, session, appRole, avatarInitial, onLogout, isLoggingOut }: Readonly<{
  guest: boolean; session: AuthSession | null; appRole: WorkspaceAppRole; avatarInitial: string;
  onLogout: () => void; isLoggingOut: boolean;
}>) {
  if (guest) {
    return <div className="app-header-right"><Link className="ghost-button app-header-btn" href="/login">Log in</Link><Link className="primary-button app-header-btn" href="/signup">Sign up</Link></div>;
  }
  return (
    <div className="app-header-right">
      <div className="app-header-identity"><span className="app-header-login">{session?.user.login ?? "user"}</span><SidebarRoleBadge appRole={appRole} /></div>
      <HeaderAvatar session={session} avatarInitial={avatarInitial} />
      <button type="button" onClick={onLogout} disabled={isLoggingOut} className="app-header-signout">
        {isLoggingOut ? <span className="sidebar-signout-spinner" aria-hidden="true" /> : <SignOutIcon size={14} />}
        <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
      </button>
    </div>
  );
}

function HeaderAvatar({ session, avatarInitial }: Readonly<{ session: AuthSession | null; avatarInitial: string }>) {
  return (
    <span className="app-header-avatar-ring">
      {session?.user.avatarUrl ? <Image src={session.user.avatarUrl} alt={session.user.name ?? session.user.login} width={32} height={32} className="app-header-avatar" unoptimized /> : <span className="app-header-avatar-fallback" aria-hidden="true">{avatarInitial}</span>}
    </span>
  );
}

/** Everything but the badge, per Main entry. */
const MAIN_ITEMS: Record<SidebarMainItem, {
  href: string;
  label: string;
  icon: SidebarNavItemProps["icon"];
  isActive: (pathname: string) => boolean;
}> = {
  home: { href: "/home", label: "Home", icon: DashboardIcon, isActive: (p) => p === "/home" },
  projects: { href: "/workflows", label: "Projects", icon: WorkflowsIcon, isActive: (p) => p === "/workflows" },
  teams: { href: "/teams", label: "Teams", icon: TeamsIcon, isActive: (p) => p === "/teams" || p.startsWith("/groups") },
  hosts: { href: "/hosts", label: "Hosts", icon: WorkflowsIcon, isActive: (p) => p === "/hosts" },
  checklists: { href: "/checklists", label: "Checklists", icon: ChecklistsIcon, isActive: (p) => p === "/checklists" },
  activity: { href: "/activity", label: "Activity", icon: ActivityIcon, isActive: (p) => p === "/activity" },
  inbox: { href: "/inbox", label: "Inbox", icon: InboxIcon, isActive: (p) => p === "/inbox" },
};

function AppSidebar({ pathname, guest, mainItems, reduced, isPlatformAdmin, unreadCount, hoverSuppressed, pinned, onTogglePinned, onNavigate, onPointerLeave }: Readonly<{
  pathname: string; guest: boolean; mainItems: readonly SidebarMainItem[]; reduced: boolean; isPlatformAdmin: boolean; unreadCount: number;
  hoverSuppressed: boolean; pinned: boolean; onTogglePinned: () => void; onNavigate: () => void; onPointerLeave: () => void;
}>) {
  const hasAccountItems = !guest || isPlatformAdmin;
  return (
    <aside className="app-sidebar" data-hover-suppressed={hoverSuppressed ? "true" : "false"} onPointerLeave={onPointerLeave} aria-label="Primary navigation">
      <div className="sidebar-edge-gradient" aria-hidden="true" />
      <SidebarPinToggle pinned={pinned} onToggle={onTogglePinned} />
      <nav className="sidebar-nav" aria-label="Primary">
        {mainItems.map((id) => {
          const item = MAIN_ITEMS[id];
          return (
            <SidebarNavItem
              key={id}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={item.isActive(pathname)}
              reduced={reduced}
              onNavigate={onNavigate}
              badgeCount={id === "inbox" ? unreadCount : 0}
            />
          );
        })}
        {hasAccountItems ? <SidebarDivider /> : null}
        {!guest && <SidebarNavItem href="/settings" label="Settings" icon={SettingsIcon} isActive={pathname === "/settings"} reduced={reduced} onNavigate={onNavigate} />}
        {isPlatformAdmin && <SidebarNavItem href="/admin" label="Admin" icon={AdminIcon} isActive={pathname.startsWith("/admin")} reduced={reduced} onNavigate={onNavigate} />}
      </nav>
    </aside>
  );
}
