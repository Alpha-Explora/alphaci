"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/features/workspace/selection";
import { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";
import type { AppRole } from "@/shared/api/contracts";

import { notificationHref } from "../../model/notification-links";
import { useNotificationsInboxViewModel } from "../view-models/use-notifications-inbox-view-model";
import {
  formatNotificationTime,
  notificationLabel,
  NotificationGlyph,
} from "./notification-utils";

type InboxViewModel = ReturnType<typeof useNotificationsInboxViewModel>;
type InboxRow = InboxViewModel["rows"][number];

/* ── Icons ─────────────────────────────────────────────────────────────────── */

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


/* ── Page ──────────────────────────────────────────────────────────────────── */

function NotificationsInboxContent() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const {
    status,
    session,
    error,
    refresh,
    signOut,
    isSigningOut: isLoggingOut,
  } = useAuthSession();

  const guest = status === "signed-in" ? isGuest(session) : false;

  /* The View owns no data. Everything below comes from the ViewModel, which is
   * the only place that knows an API exists — see model/use-inbox.ts. */
  const notificationsVm = useNotificationsInboxViewModel(
    status === "signed-in" && !guest,
    session?.user.id ?? null,
  );

  useEffect(() => {
    if (status === "signed-out") {
      router.push("/login?next=/inbox");
    }
  }, [status, router]);

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  /* ── Loading ── */
  if (status === "loading") {
    return <PipelineLoader label="Loading inbox" />;
  }

  /* ── Error ── */
  if (status === "error") {
    return <SessionError error={error} onRetry={refresh} />;
  }

  if (status === "signed-out") return null;

  return <InboxPage guest={guest} session={session} isLoggingOut={isLoggingOut} onLogout={handleLogout}
    prefersReducedMotion={prefersReducedMotion} vm={notificationsVm} appRole={session?.appRole} />;
}

function SessionError({ error, onRetry }: Readonly<{ error: string | null; onRetry: () => void }>) {
  return <main className="flow-shell page-shell"><FlowBackground /><div className="state-body"><div className="state-card"><h1>Session verification failed</h1><p>We could not verify your session. Please retry or sign in again.</p><div className="hero-actions"><button className="primary-button" type="button" onClick={onRetry}>Retry</button><Link className="ghost-button" href="/login?next=/inbox">Go to login</Link></div>{error ? <p className="error-text inbox-error-inline">{error}</p> : null}</div></div></main>;
}

function InboxPage({ guest, session, isLoggingOut, onLogout, prefersReducedMotion, vm, appRole }: Readonly<{
  guest: boolean; session: ReturnType<typeof useAuthSession>["session"]; isLoggingOut: boolean;
  onLogout: () => Promise<void>; prefersReducedMotion: boolean | null; vm: InboxViewModel;
  appRole: AppRole | null | undefined;
}>) {
  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void onLogout()}
        isLoggingOut={isLoggingOut}
      />

      <div id="main-content" className="dash-page-content inbox-page">
        <InboxHeader vm={vm} reduced={prefersReducedMotion} />
        {vm.error && <p className="error-text inbox-error-inline">{vm.error}</p>}
        <InboxState guest={guest} vm={vm} reduced={prefersReducedMotion} appRole={appRole} />
      </div>
    </main>
  );
}

function InboxHeader({ vm, reduced }: Readonly<{ vm: InboxViewModel; reduced: boolean | null }>) {
  return <motion.div className="inbox-header" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}><div><p className="inbox-kicker">ALPHACI / INBOX</p><h1 className="inbox-title"><InboxIcon size={20} />Inbox{vm.unreadCount > 0 && <span className="notification-center-unread-chip">{vm.unreadCount} unread</span>}</h1><p className="inbox-subtitle">System notifications — project provisioning, workflow runs, membership, and sync events.</p></div><InboxToolbar vm={vm} /></motion.div>;
}

function InboxToolbar({ vm }: Readonly<{ vm: InboxViewModel }>) {
  return <div className="inbox-toolbar"><div role="group" aria-label="Filter notifications" className="inbox-filter-tabs"><button type="button" className={`inbox-filter-tab${vm.filter === "all" ? " inbox-filter-tab--active" : ""}`} aria-pressed={vm.filter === "all"} onClick={() => vm.setFilter("all")}>All<span className="inbox-filter-tab-count">{vm.totalCount}</span></button><button type="button" className={`inbox-filter-tab${vm.filter === "unread" ? " inbox-filter-tab--active" : ""}`} aria-pressed={vm.filter === "unread"} onClick={() => vm.setFilter("unread")}>Unread<span className="inbox-filter-tab-count">{vm.unreadItemCount}</span></button></div>{vm.unreadItemCount > 0 && <button type="button" className="dash-action-btn" disabled={vm.isMarkingAll} onClick={() => void vm.markAllRead()}>{vm.isMarkingAll ? "Marking..." : "Mark all read"}</button>}</div>;
}

function InboxState({ guest, vm, reduced, appRole }: Readonly<{ guest: boolean; vm: InboxViewModel; reduced: boolean | null; appRole: AppRole | null | undefined }>) {
  if (guest) return <div className="settings-card"><div className="settings-section-body"><p className="inbox-state-copy">Sign in to start receiving system notifications.</p><Link href="/login" className="primary-button inbox-state-cta">Sign in</Link></div></div>;
  if (vm.status === "loading") return <p className="inbox-loading-text">Loading notifications...</p>;
  if (!vm.isEnabled) return <div className="settings-card"><div className="settings-section-body"><p className="inbox-state-copy">Notifications are not enabled for this deployment.</p></div></div>;
  if (vm.rows.length === 0) return <EmptyInbox filter={vm.filter} reduced={reduced} />;
  return <div className="inbox-list">{vm.rows.map((row) => <NotificationRow key={row.type === "header" ? `header-${row.label}` : row.item.id} row={row} reduced={reduced} vm={vm} appRole={appRole} />)}</div>;
}

function EmptyInbox({ filter, reduced }: Readonly<{ filter: InboxViewModel["filter"]; reduced: boolean | null }>) {
  const unread = filter === "unread";
  return <motion.div className="settings-card" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}><div className="settings-section-body inbox-empty"><span className="inbox-empty-icon" aria-hidden="true"><InboxIcon size={28} /></span><p className="inbox-empty-title">{unread ? "No unread notifications" : "All caught up"}</p><p className="inbox-empty-sub">{unread ? "Everything in your inbox has been read." : "New activity on your projects and workflows will show up here."}</p></div></motion.div>;
}

function NotificationRow({ row, reduced, vm, appRole }: Readonly<{ row: InboxRow; reduced: boolean | null; vm: InboxViewModel; appRole: AppRole | null | undefined }>) {
  if (row.type === "header") return <p className="inbox-day-label">{row.label}</p>;
  const href = notificationHref(row.item, appRole);
  return <motion.article className={`inbox-row${row.item.readAt ? " inbox-row--read" : ""}`} title={`${row.item.title} · ${notificationLabel(row.item.eventCode)}`} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: reduced ? 0 : Math.min(row.index * 0.015, 0.3) }}>
    {/* Stretched-link overlay (same technique as .notification-preferences-toggle's
     * input/span pair): the whole row becomes the click/tap target via a real
     * Link, while the Mark read button stays a sibling — never nested inside
     * an anchor — and sits above it via z-index. Opening a notification marks
     * it read without blocking navigation. */}
    {href ? <Link href={href} className="inbox-row-link" aria-label={`${row.item.title} — ${notificationLabel(row.item.eventCode)}`} onClick={() => { if (!row.item.readAt) void vm.markRead(row.item.id); }} /> : null}
    <NotificationGlyph item={row.item} /><span className="inbox-row-text"><strong className="inbox-row-title">{row.item.title}</strong><span className="inbox-row-snippet">{row.item.body}</span></span><time dateTime={row.item.createdAt} className="inbox-row-time">{formatNotificationTime(row.item.createdAt)}</time><NotificationAction row={row} vm={vm} /></motion.article>;
}

function NotificationAction({ row, vm }: Readonly<{ row: Extract<InboxRow, { type: "item" }>; vm: InboxViewModel }>) {
  if (row.item.readAt) return <span className="inbox-row-action dash-badge-violet">Read</span>;
  return <button type="button" className="inbox-row-action dash-action-btn" disabled={vm.markingId === row.item.id || vm.isMarkingAll} onClick={() => void vm.markRead(row.item.id)}>{vm.markingId === row.item.id ? "Saving..." : "Mark read"}</button>;
}

export function NotificationsInboxView() {
  return (
    <WorkspaceProvider>
      <NotificationsInboxContent />
    </WorkspaceProvider>
  );
}
