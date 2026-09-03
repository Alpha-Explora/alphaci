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

const SETTINGS_NAV_SECTIONS: SectionId[] = [
  "account",
  "appearance",
  "connections",
  "guide",
  "danger",
];

function navButtonStateClass(isActive: boolean, isDanger: boolean): string {
  if (isActive && isDanger) return "settings-nav-btn--active-danger";
  if (isActive) return "settings-nav-btn--active";
  if (isDanger) return "settings-nav-btn--inactive-danger";
  return "settings-nav-btn--inactive";
}

function sectionIcon(sec: SectionId): ReactNode {
  if (sec === "account") return <UserIcon size={14} />;
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
  activeSection,
  onSelectSection,
}: Readonly<{
  session: SettingsSession;
  isCompactLayout: boolean;
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

      {SETTINGS_NAV_SECTIONS.map((sec) => (
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
