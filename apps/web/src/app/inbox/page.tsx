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
            {error ? (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  const unreadCount = notifications?.unreadCount ?? 0;

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

      <div
        id="main-content"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "880px",
          margin: "0 auto",
          padding: "1.75rem var(--layout-gutter) 2.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* ── Page header ── */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
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
              ALPHACI / INBOX
            </p>
            <h1
              style={{
                fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                fontWeight: 800,
                margin: 0,
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <InboxIcon size={20} />
              Inbox
              {unreadCount > 0 && (
                <span className="notification-center-unread-chip">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "0.82rem",
                color: "var(--text-muted)",
              }}
            >
              System notifications — project provisioning, workflow runs,
              membership, and sync events.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            {/* Filter pills */}
            <div
              role="group"
              aria-label="Filter notifications"
              style={{ display: "flex", gap: "0.35rem" }}
            >
              {(["all", "unread"] as InboxFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="dash-action-btn"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  style={
                    filter === value
                      ? {
                          borderColor: "var(--accent-indigo)",
                          color: "var(--accent-indigo)",
                        }
                      : undefined
                  }
                >
                  {value === "all" ? "All" : `Unread (${unreadItems.length})`}
                </button>
              ))}
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
          <p className="error-text" style={{ margin: 0 }}>
            {notificationsError}
          </p>
        )}

        {/* ── Content states ── */}
        {guest ? (
          <div className="settings-card">
            <div className="settings-section-body">
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                }}
              >
                Activate a subscription to start receiving system
                notifications.
              </p>
              <Link
                href="/subscribe"
                className="primary-button"
                style={{
                  marginTop: "0.85rem",
                  fontSize: "0.82rem",
                  padding: "0.45rem 1.1rem",
                  display: "inline-flex",
                }}
              >
                View plans
              </Link>
            </div>
          </div>
        ) : !notifications && !notificationsError ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--text-muted)",
            }}
          >
            Loading notifications...
          </p>
        ) : notifications && !notifications.enabled ? (
          <div className="settings-card">
            <div className="settings-section-body">
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                }}
              >
                Notifications are not enabled for this deployment.
              </p>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            className="settings-card"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div
              className="settings-section-body"
              style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  color: "var(--text-muted)",
                  marginBottom: "0.6rem",
                }}
              >
                <InboxIcon size={28} />
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {filter === "unread" ? "No unread notifications" : "All caught up"}
              </p>
              <p
                style={{
                  margin: "0.3rem 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                }}
              >
                {filter === "unread"
                  ? "Everything in your inbox has been read."
                  : "New activity on your projects and workflows will show up here."}
              </p>
            </div>
          </motion.div>
        ) : (
          groups.map((group, groupIndex) => (
            <section
              key={group.label}
              aria-label={group.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                {group.label}
              </p>
              {group.items.map((notification, itemIndex) => (
                <motion.article
                  key={notification.id}
                  className="hover-field"
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, y: 8 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: (groupIndex * 3 + itemIndex) * 0.03,
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.85rem",
                    opacity: notification.readAt ? 0.72 : 1,
                  }}
                >
                  <NotificationGlyph item={notification} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: notification.readAt ? 600 : 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {notification.title}
                      </span>
                      <time
                        dateTime={notification.createdAt}
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {formatNotificationTime(notification.createdAt)}
                      </time>
                    </div>
                    <p
                      style={{
                        margin: "0.25rem 0 0.35rem",
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {notification.body}
                    </p>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        fontFamily: "ui-monospace, monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {notificationLabel(notification.eventCode)}
                    </span>
                  </div>
                  {notification.readAt ? (
                    <span
                      className="dash-badge-violet"
                      style={{ flexShrink: 0 }}
                    >
                      Read
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="dash-action-btn"
                      style={{ flexShrink: 0 }}
                      disabled={markingId === notification.id || isMarkingAll}
                      onClick={() => void handleMarkRead(notification.id)}
                    >
                      {markingId === notification.id
                        ? "Saving..."
                        : "Mark read"}
                    </button>
                  )}
                </motion.article>
              ))}
            </section>
          ))
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
