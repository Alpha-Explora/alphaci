import type { CSSProperties } from "react";

export function settingsLayoutStyle(isCompactLayout: boolean): CSSProperties {
  return {
    padding: isCompactLayout
      ? "1rem"
      : "1.75rem var(--layout-gutter) 2.5rem",
    flex: 1,
    display: "flex",
    flexDirection: isCompactLayout ? "column" : "row",
    gap: "1.75rem",
    alignItems: "flex-start",
    width: "100%",
  };
}

export function settingsSidebarStyle(isCompactLayout: boolean): CSSProperties {
  return {
    width: isCompactLayout ? "100%" : "220px",
    flexShrink: 0,
    position: isCompactLayout ? "relative" : "sticky",
    top: isCompactLayout ? "auto" : "72px",
    alignSelf: "flex-start",
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    padding: "1rem",
  };
}

export function settingsContentStyle(isCompactLayout: boolean): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    width: isCompactLayout ? "100%" : undefined,
  };
}
