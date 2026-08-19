"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { WorkspaceProvider } from "@/components/layout/workspace-context";
import { useAuthSession } from "@/hooks/use-auth-session";
import { isGuest } from "@/lib/auth/subscription";

import { useNotificationsInboxViewModel } from "../view-models/use-notifications-inbox-view-model";
import {
  formatNotificationTime,
  notificationLabel,
  NotificationGlyph,
} from "./notification-utils";

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
  const {
    rows,
    unreadCount,
    unreadItemCount,
    totalCount,
    isEnabled,
    status: notificationsStatus,
    error: notificationsError,
    filter,
    setFilter,
    markingId,
    isMarkingAll,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
  } = useNotificationsInboxViewModel(status === "signed-in" && !guest);

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
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <h1>Session verification failed</h1>
            <p>
              We could not verify your session. Please retry or sign in again.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/inbox">
                Go to login
              </Link>
            </div>
            {error ? <p className="error-text inbox-error-inline">{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      <div id="main-content" className="dash-page-content inbox-page">
        {/* ── Page header ── */}
        <motion.div
          className="inbox-header"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}
        >
          <div>
            <p className="inbox-kicker">ALPHACI / INBOX</p>
            <h1 className="inbox-title">
              <InboxIcon size={20} />
              Inbox
              {unreadCount > 0 && (
                <span className="notification-center-unread-chip">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="inbox-subtitle">
              System notifications — project provisioning, workflow runs,
              membership, and sync events.
            </p>
          </div>

          <div className="inbox-toolbar">
            {/* Gmail-style filter tabs with live counts */}
            <div
              role="group"
              aria-label="Filter notifications"
              className="inbox-filter-tabs"
            >
              <button
                type="button"
                className={`inbox-filter-tab${filter === "all" ? " inbox-filter-tab--active" : ""}`}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
                <span className="inbox-filter-tab-count">{totalCount}</span>
              </button>
              <button
                type="button"
                className={`inbox-filter-tab${filter === "unread" ? " inbox-filter-tab--active" : ""}`}
                aria-pressed={filter === "unread"}
                onClick={() => setFilter("unread")}
              >
                Unread
                <span className="inbox-filter-tab-count">
                  {unreadItemCount}
                </span>
              </button>
            </div>

            {unreadItemCount > 0 && (
              <button
                type="button"
                className="dash-action-btn"
                disabled={isMarkingAll}
                onClick={() => void handleMarkAllRead()}
              >
                {isMarkingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>
        </motion.div>

        {notificationsError && (
          <p className="error-text inbox-error-inline">{notificationsError}</p>
        )}

        {/* ── Content states ── */}
        {guest ? (
          <div className="settings-card">
            <div className="settings-section-body">
              <p className="inbox-state-copy">
                Activate a subscription to start receiving system
                notifications.
              </p>
              <Link href="/subscribe" className="primary-button inbox-state-cta">
                View plans
              </Link>
            </div>
          </div>
        ) : notificationsStatus === "loading" ? (
          <p className="inbox-loading-text">Loading notifications...</p>
        ) : !isEnabled ? (
          <div className="settings-card">
            <div className="settings-section-body">
              <p className="inbox-state-copy">
                Notifications are not enabled for this deployment.
              </p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <motion.div
            className="settings-card"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="settings-section-body inbox-empty">
              <span className="inbox-empty-icon" aria-hidden="true">
                <InboxIcon size={28} />
              </span>
              <p className="inbox-empty-title">
                {filter === "unread" ? "No unread notifications" : "All caught up"}
              </p>
              <p className="inbox-empty-sub">
                {filter === "unread"
                  ? "Everything in your inbox has been read."
                  : "New activity on your projects and workflows will show up here."}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="inbox-list">
            {rows.map((row) =>
              row.type === "header" ? (
                <p key={`header-${row.label}`} className="inbox-day-label">
                  {row.label}
                </p>
              ) : (
                <motion.article
                  key={row.item.id}
                  className={`inbox-row${row.item.readAt ? " inbox-row--read" : ""}`}
                  title={`${row.item.title} · ${notificationLabel(row.item.eventCode)}`}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.18,
                    delay: prefersReducedMotion
                      ? 0
                      : Math.min(row.index * 0.015, 0.3),
                  }}
                >
                  <NotificationGlyph item={row.item} />
                  <span className="inbox-row-text">
                    <strong className="inbox-row-title">
                      {row.item.title}
                    </strong>
                    <span className="inbox-row-snippet">{row.item.body}</span>
                  </span>
                  <time
                    dateTime={row.item.createdAt}
                    className="inbox-row-time"
                  >
                    {formatNotificationTime(row.item.createdAt)}
                  </time>
                  {row.item.readAt ? (
                    <span className="inbox-row-action dash-badge-violet">
                      Read
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inbox-row-action dash-action-btn"
                      disabled={markingId === row.item.id || isMarkingAll}
                      onClick={() => void handleMarkRead(row.item.id)}
                    >
                      {markingId === row.item.id ? "Saving..." : "Mark read"}
                    </button>
                  )}
                </motion.article>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export function NotificationsInboxView() {
  return (
    <WorkspaceProvider>
      <NotificationsInboxContent />
    </WorkspaceProvider>
  );
}
