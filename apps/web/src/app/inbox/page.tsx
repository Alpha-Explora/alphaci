"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import {
  formatNotificationTime,
  notificationLabel,
  NotificationGlyph,
} from "@/components/layout/notification-utils";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { WorkspaceProvider } from "@/components/layout/workspace-context";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import type {
  NotificationItem,
  NotificationsResponse,
} from "@/lib/api/contracts";
import {
  getNotifications,
  markNotificationRead,
} from "@/lib/api/notifications";
import { isGuest } from "@/lib/auth/subscription";

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

/* ── Day grouping ──────────────────────────────────────────────────────────── */

interface NotificationGroup {
  label: string;
  items: NotificationItem[];
}

function groupNotificationsByDay(
  items: NotificationItem[],
): NotificationGroup[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const groups: NotificationGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (Number.isNaN(created.getTime())) {
      groups[3].items.push(item);
    } else if (created >= startOfToday) {
      groups[0].items.push(item);
    } else if (created >= startOfYesterday) {
      groups[1].items.push(item);
    } else if (created >= startOfWeek) {
      groups[2].items.push(item);
    } else {
      groups[3].items.push(item);
    }
  }

  return groups.filter((group) => group.items.length > 0);
}

/* Flatten day groups into one continuous row list (day-label rows interspersed
 * with item rows) so the list reads as one smooth surface, not stacked cards,
 * while keeping a stable per-item index for a snappy, capped stagger-in. */
type InboxRow =
  | { type: "header"; label: string }
  | { type: "item"; item: NotificationItem; index: number };

function flattenGroups(groups: NotificationGroup[]): InboxRow[] {
  const rows: InboxRow[] = [];
  let index = 0;
  for (const group of groups) {
    rows.push({ type: "header", label: group.label });
    for (const item of group.items) {
      rows.push({ type: "item", item, index });
      index += 1;
    }
  }
  return rows;
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

type InboxFilter = "all" | "unread";

function InboxPageContent() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationsResponse | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null,
  );
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const guest = status === "signed-in" ? isGuest(session) : false;

  useEffect(() => {
    if (status === "signed-out") {
      router.push("/login?next=/inbox");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "signed-in" || guest) return;
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
  }, [status, guest]);

  const unreadItems = useMemo(
    () => notifications?.items.filter((item) => !item.readAt) ?? [],
    [notifications],
  );

  const visibleItems = useMemo(() => {
    if (!notifications) return [];
    return filter === "unread" ? unreadItems : notifications.items;
  }, [notifications, filter, unreadItems]);

  const groups = useMemo(
    () => groupNotificationsByDay(visibleItems),
    [visibleItems],
  );

  const rows = useMemo(() => flattenGroups(groups), [groups]);

  function applyMarkedRead(id: string) {
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

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    setNotificationsError(null);
    try {
      await markNotificationRead(id);
      applyMarkedRead(id);
    } catch {
      setNotificationsError("Notification update failed.");
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    setIsMarkingAll(true);
    setNotificationsError(null);
    try {
      for (const item of unreadItems) {
        await markNotificationRead(item.id);
        applyMarkedRead(item.id);
      }
    } catch {
      setNotificationsError(
        "Some notifications could not be marked as read. Please retry.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      await refresh();
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
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

  const unreadCount = notifications?.unreadCount ?? 0;
  const totalCount = notifications?.items.length ?? 0;

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
                  {unreadItems.length}
                </span>
              </button>
            </div>

            {unreadItems.length > 0 && (
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
                Sign in to start receiving system notifications.
              </p>
              <Link href="/login" className="primary-button inbox-state-cta">
                Sign in
              </Link>
            </div>
          </div>
        ) : !notifications && !notificationsError ? (
          <p className="inbox-loading-text">Loading notifications...</p>
        ) : notifications && !notifications.enabled ? (
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

export default function InboxPage() {
  return (
    <WorkspaceProvider>
      <InboxPageContent />
    </WorkspaceProvider>
  );
}
