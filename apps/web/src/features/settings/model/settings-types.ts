/* Domain types for the settings surface. */
export type { WorkspacesMeResponse } from "@/shared/api/contracts";

/** The sections the settings rail switches between. */
export type SettingsSection =
  | "account"
  | "appearance"
  | "connections"
  | "guide"
  | "danger";

export const SECTION_LABELS: Record<SettingsSection, string> = {
  account: "Account",
  appearance: "Appearance",
  connections: "Connections",
  guide: "Guide",
  danger: "Danger Zone",
};
