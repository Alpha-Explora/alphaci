"use client";

import type { ReactNode } from "react";

import type { useAuthSession } from "@/features/auth/session";

import {
  SECTION_LABELS,
  type SettingsSection as SectionId,
} from "../../model/settings-types";
import {
  AlertTriangleIcon,
  AppearanceIcon,
  BookOpenIcon,
  GithubIcon,
  UserIcon,
} from "./settings-chrome";
import { settingsSidebarStyle } from "./settings-layout";
import { SettingsUserAvatar } from "./settings-user-avatar";

type SettingsSession = ReturnType<typeof useAuthSession>["session"];

function TeamIcon({ size = 14 }: Readonly<{ size?: number }>) {
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

function navButtonStateClass(isActive: boolean, isDanger: boolean): string {
  if (isActive && isDanger) return "settings-nav-btn--active-danger";
  if (isActive) return "settings-nav-btn--active";
  if (isDanger) return "settings-nav-btn--inactive-danger";
  return "settings-nav-btn--inactive";
}

function sectionIcon(sec: SectionId): ReactNode {
  if (sec === "account") return <UserIcon size={14} />;
  if (sec === "team") return <TeamIcon size={14} />;
  if (sec === "appearance") return <AppearanceIcon size={14} />;
  if (sec === "connections") return <GithubIcon size={14} />;
  if (sec === "guide") return <BookOpenIcon size={14} />;
  return <AlertTriangleIcon size={14} />;
}

function SettingsNavButton({
  sec,
  isActive,
  onSelect,
}: Readonly<{
  sec: SectionId;
  isActive: boolean;
  onSelect: (sec: SectionId) => void;
}>) {
  const isDanger = sec === "danger";
  return (
    <button
      key={sec}
      type="button"
      onClick={() => onSelect(sec)}
      aria-current={isActive ? "true" : undefined}
      className={`settings-nav-btn ${navButtonStateClass(isActive, isDanger)}`}
    >
      {sectionIcon(sec)}
      {SECTION_LABELS[sec]}
    </button>
  );
}

export function SettingsSidebar({
  session,
  isCompactLayout,
  sections,
  activeSection,
  onSelectSection,
}: Readonly<{
  session: SettingsSession;
  isCompactLayout: boolean;
  /** The rail's entries, in order (Team only for its Lead/admin). */
  sections: readonly SectionId[];
  activeSection: SectionId;
  onSelectSection: (sec: SectionId) => void;
}>) {
  return (
    <nav
      className="settings-sidebar settings-sidebar-surface"
      aria-label="Settings sections"
      style={settingsSidebarStyle(isCompactLayout)}
    >
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
          <SettingsUserAvatar session={session} size={36} fontSize="0.9rem" />
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

      {sections.map((sec) => (
        <SettingsNavButton
          key={sec}
          sec={sec}
          isActive={activeSection === sec}
          onSelect={onSelectSection}
        />
      ))}
    </nav>
  );
}
