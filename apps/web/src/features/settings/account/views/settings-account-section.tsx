"use client";

import { motion } from "framer-motion";

import type { useAuthSession } from "@/features/auth/session";
import EnterpriseClientCompositionSettingsView from "@/features/settings/client-composition";
import type { ClientCompositionInfo } from "@/shared/api/contracts";

import type { WorkspacesMeResponse } from "../../model/settings-types";
import {
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
        className="settings-account-fields"
      >
        <div className="settings-account-fields__row">
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
}: Readonly<{
  workspaces: WorkspacesMeResponse | null;
  workspacesError: string | null;
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
        <div className="settings-workspaces">
          {workspaces.items.map((workspace) => (
            <article
              key={workspace.id}
              className="settings-workspace"
            >
              <div className="settings-workspace__header">
                <strong>{workspace.name}</strong>
                <span>{workspace.kind} / {workspace.role}</span>
              </div>
              <WorkspaceMembersSection workspace={workspace} />
            </article>
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

export function SettingsAccountSection({
  session,
  prefersReducedMotion,
  workspacesEnabled,
  workspaces,
  workspacesError,
  clientComposition,
}: Readonly<{
  session: SettingsSession;
  prefersReducedMotion: boolean | null;
  workspacesEnabled: boolean;
  workspaces: WorkspacesMeResponse | null;
  workspacesError: string | null;
  clientComposition: ClientCompositionInfo | null;
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
        />
      ) : null}
      {clientComposition ? (
        <EnterpriseClientCompositionSettingsView
          composition={clientComposition}
        />
      ) : null}
    </>
  );
}
