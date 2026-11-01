"use client";

import { ThemeToggle } from "@/shared/layout/theme-toggle";

import { AppearanceIcon, SettingsSection } from "./settings-chrome";

export function SettingsAppearanceSection() {
  return (
    <SettingsSection icon={<AppearanceIcon />} title="Appearance" index={0}>
      <div className="settings-preference-stack">
        <div className="settings-preference-card settings-preference-card--accent">
          <div className="settings-preference-copy">
            <span className="settings-preference-kicker">Interface theme</span>
            <strong>Light mode</strong>
            <span>
              Switch the workspace shell, workflow studio, and settings panels
              between dark and light mode.
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
  );
}
