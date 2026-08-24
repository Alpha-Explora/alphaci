"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { ThemeToggle } from "@/shared/layout/theme-toggle";
import { WorkspaceMembersSection } from "@/components/settings/workspace-members-section";
import { NotificationsPreferencesView } from "@/features/notifications/preferences";
import { useNotificationsInboxViewModel } from "@/features/notifications/inbox";
import type { useAuthSession } from "@/features/auth/session";
import { useCapabilities } from "@/features/capabilities/current";
import { isGuest } from "@/features/auth/session";

import { canDeleteAccount } from "../../model/settings-rules";
import {
  SECTION_LABELS,
  type SettingsSection as SectionId,
} from "../../model/settings-types";
import { useSettingsViewModel } from "../view-models/use-settings-view-model";
import {
  AlertTriangleIcon,
  AppearanceIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  GithubIcon,
  HoverField,
  SettingsSection,
  UserIcon,
} from "./settings-chrome";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
};

/**
 * The settings surface itself.
 *
 * The local names below are aliases onto the view-model, so the markup under
 * them is what was in the route, moved rather than rewritten.
 */
export function SettingsContent({
  session,
  onLogout,
  isLoggingOut,
  logoutMessage,
  prefersReducedMotion,
  isCompactLayout,
  onDeleted,
}: Readonly<{
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
  logoutMessage: string | null;
  prefersReducedMotion: boolean | null;
  isCompactLayout: boolean;
  onDeleted: () => void;
}>) {
  const { workspacesEnabled, notificationsEnabled } = useCapabilities();
  const vm = useSettingsViewModel({ workspacesEnabled });

  const guest = isGuest(session);
  const activeSection = vm.activeSection;
  const setActiveSection = vm.setActiveSection;
  const workspaces = vm.workspaces;
  const workspacesError = vm.workspacesError;
  const isDeleting = vm.isDeleting;
  const deleteMessage = vm.deleteMessage;
  const showDeleteConfirm = vm.showDeleteConfirm;
  const setShowDeleteConfirm = vm.setShowDeleteConfirm;
  const deleteConfirmInput = vm.deleteConfirmInput;
  const setDeleteConfirmInput = vm.setDeleteConfirmInput;

  /* Notifications state comes from the feature's ViewModel — the same hook the
   * inbox uses. This page used to re-implement the fetch, the optimistic
   * mark-read and the error strings by hand. */
  const {
    items: notificationItems,
    unreadCount: notificationUnreadCount,
    status: notificationsStatus,
    error: notificationsError,
    markingId: markingNotificationId,
    markRead: handleMarkNotificationRead,
  } = useNotificationsInboxViewModel(
    activeSection === "account" && notificationsEnabled,
  );

  async function handleDeleteAccount() {
    if (await vm.deleteAccount()) onDeleted();
  }

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();
  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
      />

      <div
        className="settings-layout"
        id="main-content"
        style={{
          padding: isCompactLayout
            ? "1rem"
            : "1.75rem var(--layout-gutter) 2.5rem",
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
          className="settings-sidebar settings-sidebar-surface"
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
            padding: "1rem",
          }}
        >
          {/* Mini profile summary */}
          <div
            className="settings-sidebar-profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              paddingBottom: "0.85rem",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: "50%",
                padding: "1.5px",
                background:
                  "linear-gradient(135deg, var(--brand), var(--accent-violet))",
                flexShrink: 0,
              }}
            >
              {session?.user.avatarUrl ? (
                <Image
                  src={session.user.avatarUrl}
                  alt={session.user.name ?? session.user.login}
                  width={36}
                  height={36}
                  style={{
                    borderRadius: "50%",
                    display: "block",
                    border: "2px solid var(--bg-base)",
                  }}
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
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session?.user.name ?? session?.user.login ?? "Account"}
              </p>
            </div>
          </div>

          {/* Section nav buttons */}
          {(
            [
              "account",
              "appearance",
              "connections",
              "guide",
              "danger",
            ] as SectionId[]
          ).map((sec) => {
            const isActive = activeSection === sec;
            const isDanger = sec === "danger";
            const icons: Record<SectionId, React.ReactNode> = {
              account: <UserIcon size={14} />,
              appearance: <AppearanceIcon size={14} />,
              connections: <GithubIcon size={14} />,
              guide: <BookOpenIcon size={14} />,
              danger: <AlertTriangleIcon size={14} />,
            };
            const stateClass = isActive
              ? isDanger
                ? "settings-nav-btn--active-danger"
                : "settings-nav-btn--active"
              : isDanger
                ? "settings-nav-btn--inactive-danger"
                : "settings-nav-btn--inactive";
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setActiveSection(sec)}
                aria-current={isActive ? "true" : undefined}
                className={`settings-nav-btn ${stateClass}`}
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
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {/* ── Account section ── */}
              {activeSection === "account" && (
                <>
                  {/* Profile header — flat with gradient accent */}
                  <motion.div
                    className="settings-profile-header"
                    initial={
                      prefersReducedMotion ? undefined : { opacity: 0, y: 14 }
                    }
                    animate={
                      prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
                    }
                    transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}
                    style={{
                      position: "relative",
                      borderRadius: "1rem",
                      overflow: "hidden",
                      padding: "clamp(1.25rem, 3vw, 1.75rem)",
                    }}
                  >
                    {/* Gradient top bar — brand + violet */}
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
                      {/* Avatar with gradient ring — brand to violet */}
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
                        {session?.user.avatarUrl ? (
                          <Image
                            src={session.user.avatarUrl}
                            alt={session.user.name ?? session.user.login}
                            width={64}
                            height={64}
                            style={{
                              borderRadius: "50%",
                              display: "block",
                              border: "2px solid var(--bg-base)",
                            }}
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
                          {session?.user.name ??
                            session?.user.login ??
                            "Your account"}
                        </h1>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            flexWrap: "wrap",
                          }}
                        >
                          {session?.user.login && (
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
                          )}
                          {session?.user.email && (
                            <span
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {session.user.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Account identity */}
                  <SettingsSection
                    icon={<UserIcon />}
                    title="Account"
                    index={0}
                  >
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
                  {workspacesEnabled ? (
                    <SettingsSection
                      icon={<UserIcon />}
                      title="Workspace"
                      index={1}
                    >
                      {workspacesError ? (
                        <p className="error-text" style={{ margin: 0 }}>
                          {workspacesError}
                        </p>
                      ) : workspaces?.items.length ? (
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
                                currentUserId={session?.user.id ?? ""}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Loading workspace...
                        </p>
                      )}
                    </SettingsSection>
                  ) : null}

                  {notificationsEnabled ? (
                    <SettingsSection
                      icon={<AlertTriangleIcon />}
                      title="Notifications"
                      index={2}
                    >
                      {notificationsError ? (
                        <p className="error-text" style={{ margin: 0 }}>
                          {notificationsError}
                        </p>
                      ) : notificationsStatus !== "loading" ? (
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
                          {notificationItems.length ? (
                            notificationItems.map((notification) => (
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
                                {notification.readAt ? (
                                  <span className="dash-badge-violet">
                                    Read
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="dash-action-btn"
                                    disabled={
                                      markingNotificationId === notification.id
                                    }
                                    onClick={() =>
                                      void handleMarkNotificationRead(
                                        notification.id,
                                      )
                                    }
                                  >
                                    {markingNotificationId === notification.id
                                      ? "Saving..."
                                      : "Mark read"}
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <p
                              style={{
                                margin: 0,
                                fontSize: "0.8rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              No notifications.
                            </p>
                          )}
                          <div
                            style={{
                              borderTop: "1px solid var(--border-soft)",
                              paddingTop: "0.75rem",
                            }}
                          >
                            <NotificationsPreferencesView />
                          </div>
                        </div>
                      ) : (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Loading notifications...
                        </p>
                      )}
                    </SettingsSection>
                  ) : null}
                </>
              )}

              {/* Appearance section */}
              {activeSection === "appearance" && (
                <SettingsSection
                  icon={<AppearanceIcon />}
                  title="Appearance"
                  index={0}
                >
                  <div className="settings-preference-stack">
                    <div className="settings-preference-card settings-preference-card--accent">
                      <div className="settings-preference-copy">
                        <span className="settings-preference-kicker">
                          Interface theme
                        </span>
                        <strong>Light mode</strong>
                        <span>
                          Switch the workspace shell, workflow studio, and
                          settings panels between dark and light mode.
                        </span>
                      </div>
                      <ThemeToggle size="md" />
                    </div>

                    <div className="settings-appearance-preview" aria-hidden="true">
                      <div className="settings-appearance-preview-bar" />
                      <div className="settings-appearance-preview-body">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                </SettingsSection>
              )}

              {/* ── Connections section ── */}
              {activeSection === "connections" && (
                <SettingsSection
                  icon={<GithubIcon />}
                  title="GitHub Connection"
                  index={0}
                >
                  <div
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
                        gap: "0.3rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span className="dash-status-active" />
                        <span
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          GitHub App connected
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Manage your GitHub App connection from the Create
                        Project page.
                      </p>
                    </div>
                    <Link href="/workflows" className="dash-action-btn">
                      Manage
                      <ExternalLinkIcon size={11} />
                    </Link>
                  </div>
                </SettingsSection>
              )}

              {/* ── Guide section ── */}
              {activeSection === "guide" && (
                <SettingsSection
                  icon={<BookOpenIcon />}
                  title="Guide"
                  index={0}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.88rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      ALPHACI turns a blank idea into a working repository in
                      one step — GitHub repo, protected branches, and a
                      ready-to-run CI/CD pipeline, all committed automatically.
                    </p>

                    {/* Topic overview */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                        }}
                      >
                        What is covered
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.3rem",
                        }}
                      >
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
                    <div
                      style={{
                        display: "flex",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                        paddingTop: "0.25rem",
                        borderTop: "1px solid var(--border-soft)",
                      }}
                    >
                      <Link
                        href="/guide"
                        className="primary-button"
                        style={{
                          fontSize: "0.82rem",
                          padding: "0.45rem 1.1rem",
                        }}
                      >
                        Open full guide
                      </Link>
                      <Link
                        href="/workflows?tour=1"
                        className="ghost-button"
                        style={{
                          fontSize: "0.82rem",
                          padding: "0.45rem 1.1rem",
                        }}
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
                <SettingsSection
                  icon={<AlertTriangleIcon />}
                  title="Danger Zone"
                  index={0}
                  danger
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    {/* Sign out */}
                    <div
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
                          gap: "0.3rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          Sign out of ALPHACI
                        </span>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Your session will be terminated and you will be
                          redirected to the home page.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={onLogout}
                        disabled={isLoggingOut}
                        className="confirm-btn-danger"
                        style={{
                          padding: "0.4rem 0.85rem",
                          fontSize: "0.82rem",
                          flexShrink: 0,
                          cursor: isLoggingOut ? "not-allowed" : "pointer",
                          opacity: isLoggingOut ? 0.6 : 1,
                        }}
                      >
                        {isLoggingOut ? "Signing out..." : "Sign out"}
                      </button>
                    </div>
                    {logoutMessage && (
                      <p
                        className="error-text"
                        style={{ marginTop: "-0.5rem" }}
                      >
                        {logoutMessage}
                      </p>
                    )}

                    <div
                      style={{
                        borderTop: "1px solid rgba(248, 113, 113, 0.12)",
                      }}
                    />

                    {/* Archive account */}
                    {!showDeleteConfirm ? (
                      <div
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
                            gap: "0.3rem",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            Archive your account
                          </span>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            Your account and data are archived for 30 days. You
                            can restore everything by signing in again within
                            that window.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm(true);
                            vm.clearDeleteMessage();
                            setDeleteConfirmInput("");
                          }}
                          className="confirm-btn-danger"
                          style={{
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.82rem",
                            flexShrink: 0,
                          }}
                        >
                          Archive my account
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "rgba(248, 113, 113, 0.05)",
                          border: "1px solid rgba(248, 113, 113, 0.2)",
                          borderRadius: "0.75rem",
                          padding: "1.25rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.9rem",
                              fontWeight: 700,
                              color: "var(--danger)",
                            }}
                          >
                            This will archive your account.
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            Your account and all associated data will be
                            archived — not immediately deleted. You can sign in
                            with GitHub within{" "}
                            <strong style={{ color: "var(--text-secondary)" }}>
                              30 days
                            </strong>{" "}
                            to fully restore your account. After 30 days the
                            archived account is permanently deleted.
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            <strong style={{ color: "var(--text-secondary)" }}>
                              Your GitHub repositories and any workflow files
                              committed to them are not affected
                            </strong>{" "}
                            — they remain on GitHub regardless of what you
                            choose here.
                          </p>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.4rem",
                          }}
                        >
                          <label
                            htmlFor="delete-confirm-input"
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Type your username{" "}
                            <strong
                              style={{
                                color: "var(--text-primary)",
                                fontFamily: "ui-monospace, monospace",
                              }}
                            >
                              {session?.user.login}
                            </strong>{" "}
                            to confirm:
                          </label>
                          <input
                            id="delete-confirm-input"
                            type="text"
                            value={deleteConfirmInput}
                            onChange={(e) =>
                              setDeleteConfirmInput(e.target.value)
                            }
                            placeholder={session?.user.login ?? "username"}
                            autoComplete="off"
                            style={{
                              background: "rgba(17, 17, 22, 0.6)",
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
                            disabled={
                              isDeleting ||
                              !canDeleteAccount(deleteConfirmInput, session?.user.login)
                            }
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "#fff",
                              padding: "0.45rem 1rem",
                              borderRadius: "0.5rem",
                              border: "1px solid rgba(248, 113, 113, 0.6)",
                              background:
                                isDeleting ||
                                !canDeleteAccount(deleteConfirmInput, session?.user.login)
                                  ? "rgba(248, 113, 113, 0.2)"
                                  : "rgba(248, 113, 113, 0.7)",
                              cursor:
                                isDeleting ||
                                !canDeleteAccount(deleteConfirmInput, session?.user.login)
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: isDeleting ? 0.6 : 1,
                              transition: "all 0.2s ease",
                            }}
                          >
                            {isDeleting ? "Archiving..." : "Archive my account"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              vm.clearDeleteMessage();
                              setDeleteConfirmInput("");
                            }}
                            disabled={isDeleting}
                            className="confirm-btn-neutral"
                            style={{
                              padding: "0.45rem 0.85rem",
                              fontSize: "0.82rem",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        {deleteMessage && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.8rem",
                              color: "var(--danger)",
                            }}
                          >
                            {deleteMessage}
                          </p>
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
