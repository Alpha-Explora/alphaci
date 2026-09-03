"use client";

import { motion } from "framer-motion";

import type { useAuthSession } from "@/features/auth/session";
import type {
  NotificationItem,
  NotificationsStatus,
} from "@/features/notifications";
import { NotificationsPreferencesView } from "@/features/notifications/preferences";

import type { WorkspacesMeResponse } from "../../model/settings-types";
import {
  AlertTriangleIcon,
  GithubIcon,
  HoverField,
  SettingsSection,
  UserIcon,
} from "./settings-chrome";
import { SettingsUserAvatar } from "./settings-user-avatar";
import { WorkspaceMembersSection } from "./workspace-members-section";

type SettingsSession = ReturnType<typeof useAuthSession>["session"];

function accountDisplayName(session: SettingsSession): string {
  return session?.user.name ?? session?.user.login ?? "Your account";
}

function AccountIdentityChips({ session }: Readonly<{ session: SettingsSession }>) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        flexWrap: "wrap",
      }}
    >
      {session?.user.login ? (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <GithubIcon size={13} />@{session.user.login}
        </span>
      ) : null}
      {session?.user.email ? (
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
          }}
        >
          {session.user.email}
        </span>
      ) : null}
    </div>
  );
}

function AccountProfileHeader({
  session,
  prefersReducedMotion,
}: Readonly<{
  session: SettingsSession;
  prefersReducedMotion: boolean | null;
}>) {
  const motionProps = prefersReducedMotion
    ? undefined
    : { opacity: 0, y: 14 };
  return (
    <motion.div
      className="settings-profile-header"
      initial={motionProps}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}
      style={{
        position: "relative",
        borderRadius: "1rem",
        overflow: "hidden",
        padding: "clamp(1.25rem, 3vw, 1.75rem)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            "linear-gradient(90deg, var(--brand), var(--accent-violet))",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            position: "relative",
            borderRadius: "50%",
            padding: "2.5px",
            background:
              "linear-gradient(135deg, var(--brand), var(--accent-violet))",
            flexShrink: 0,
          }}
        >
          <SettingsUserAvatar session={session} size={64} fontSize="1.5rem" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
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
            SETTINGS / ACCOUNT
          </p>
          <h1
            style={{
              fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
              fontWeight: 800,
              margin: "0 0 0.2rem",
              letterSpacing: "-0.02em",
            }}
          >
            {accountDisplayName(session)}
          </h1>
          <AccountIdentityChips session={session} />
        </div>
      </div>
    </motion.div>
  );
}

function AccountIdentitySection({
  session,
}: Readonly<{ session: SettingsSession }>) {
  return (
    <SettingsSection icon={<UserIcon />} title="Account" index={0}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
          }}
        >
          <HoverField
            label="Display name"
            value={session?.user.name ?? "—"}
            editable={false}
          />
          <HoverField
            label="GitHub login"
            value={`@${session?.user.login ?? "—"}`}
            editable={false}
          />
        </div>
        {session?.user.email ? (
          <HoverField
            label="Email"
            value={session.user.email}
            editable={false}
          />
        ) : null}
      </div>
    </SettingsSection>
  );
}

function AccountWorkspaceSection({
  workspaces,
  workspacesError,
  currentUserId,
}: Readonly<{
  workspaces: WorkspacesMeResponse | null;
  workspacesError: string | null;
  currentUserId: string;
}>) {
  if (workspacesError) {
    return (
      <SettingsSection icon={<UserIcon />} title="Workspace" index={1}>
        <p className="error-text" style={{ margin: 0 }}>
          {workspacesError}
        </p>
      </SettingsSection>
    );
  }

  if (workspaces?.items.length) {
    return (
      <SettingsSection icon={<UserIcon />} title="Workspace" index={1}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {workspaces.items.map((workspace) => (
            <div
              key={workspace.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div
                className="hover-field"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {workspace.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      textTransform: "capitalize",
                    }}
                  >
                    {workspace.kind} / {workspace.role}
                  </span>
                </div>
              </div>
              <WorkspaceMembersSection
                workspace={workspace}
                currentUserId={currentUserId}
              />
            </div>
          ))}
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection icon={<UserIcon />} title="Workspace" index={1}>
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        Loading workspace...
      </p>
    </SettingsSection>
  );
}

function NotificationReadControl({
  notification,
  markingNotificationId,
  onMarkRead,
}: Readonly<{
  notification: NotificationItem;
  markingNotificationId: string | null;
  onMarkRead: (id: string) => void;
}>) {
  if (notification.readAt) {
    return <span className="dash-badge-violet">Read</span>;
  }
  const saving = markingNotificationId === notification.id;
  return (
    <button
      type="button"
      className="dash-action-btn"
      disabled={saving}
      onClick={() => void onMarkRead(notification.id)}
    >
      {saving ? "Saving..." : "Mark read"}
    </button>
  );
}

function AccountNotificationsList({
  notificationItems,
  markingNotificationId,
  onMarkRead,
}: Readonly<{
  notificationItems: NotificationItem[];
  markingNotificationId: string | null;
  onMarkRead: (id: string) => void;
}>) {
  if (!notificationItems.length) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        No notifications.
      </p>
    );
  }

  return (
    <>
      {notificationItems.map((notification) => (
        <div
          key={notification.id}
          className="hover-field"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              maxWidth: "min(100%, 560px)",
            }}
          >
            <span
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {notification.title}
            </span>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
              }}
            >
              {notification.body}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {notification.eventCode}
            </span>
          </div>
          <NotificationReadControl
            notification={notification}
            markingNotificationId={markingNotificationId}
            onMarkRead={onMarkRead}
          />
        </div>
      ))}
    </>
  );
}

function AccountNotificationsSection({
  notificationsError,
  notificationsStatus,
  notificationUnreadCount,
  notificationItems,
  markingNotificationId,
  onMarkRead,
}: Readonly<{
  notificationsError: string | null;
  notificationsStatus: NotificationsStatus;
  notificationUnreadCount: number;
  notificationItems: NotificationItem[];
  markingNotificationId: string | null;
  onMarkRead: (id: string) => void;
}>) {
  if (notificationsError) {
    return (
      <SettingsSection
        icon={<AlertTriangleIcon />}
        title="Notifications"
        index={2}
      >
        <p className="error-text" style={{ margin: 0 }}>
          {notificationsError}
        </p>
      </SettingsSection>
    );
  }

  if (notificationsStatus !== "loading") {
    return (
      <SettingsSection
        icon={<AlertTriangleIcon />}
        title="Notifications"
        index={2}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <span
            style={{
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {notificationUnreadCount} unread
          </span>
          <AccountNotificationsList
            notificationItems={notificationItems}
            markingNotificationId={markingNotificationId}
            onMarkRead={onMarkRead}
          />
          <div
            style={{
              borderTop: "1px solid var(--border-soft)",
              paddingTop: "0.75rem",
            }}
          >
            <NotificationsPreferencesView />
          </div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      icon={<AlertTriangleIcon />}
      title="Notifications"
      index={2}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        Loading notifications...
      </p>
    </SettingsSection>
  );
}

export function SettingsAccountSection({
  session,
  prefersReducedMotion,
  workspacesEnabled,
  workspaces,
  workspacesError,
  notificationsEnabled,
  notificationsError,
  notificationsStatus,
  notificationUnreadCount,
  notificationItems,
  markingNotificationId,
  onMarkRead,
}: Readonly<{
  session: SettingsSession;
  prefersReducedMotion: boolean | null;
  workspacesEnabled: boolean;
  workspaces: WorkspacesMeResponse | null;
  workspacesError: string | null;
  notificationsEnabled: boolean;
  notificationsError: string | null;
  notificationsStatus: NotificationsStatus;
  notificationUnreadCount: number;
  notificationItems: NotificationItem[];
  markingNotificationId: string | null;
  onMarkRead: (id: string) => void;
}>) {
  return (
    <>
      <AccountProfileHeader
        session={session}
        prefersReducedMotion={prefersReducedMotion}
      />
      <AccountIdentitySection session={session} />
      {workspacesEnabled ? (
        <AccountWorkspaceSection
          workspaces={workspaces}
          workspacesError={workspacesError}
          currentUserId={session?.user.id ?? ""}
        />
      ) : null}
      {notificationsEnabled ? (
        <AccountNotificationsSection
          notificationsError={notificationsError}
          notificationsStatus={notificationsStatus}
          notificationUnreadCount={notificationUnreadCount}
          notificationItems={notificationItems}
          markingNotificationId={markingNotificationId}
          onMarkRead={onMarkRead}
        />
      ) : null}
    </>
  );
}
