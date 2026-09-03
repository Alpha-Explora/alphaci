"use client";

import { EXISTING_REPO_MODE_ENABLED } from "./setup-tab-shared";

function ModeToggleButton({
  mode,
  onChangeSetupMode,
  setupMode,
}: Readonly<{
  mode: "new" | "existing";
  onChangeSetupMode: (value: "new" | "existing") => void;
  setupMode: "new" | "existing";
}>) {
  const label = mode === "new" ? "New repository" : "Existing repository";
  return (
    <button
      type="button"
      className="cp-mode-btn"
      aria-pressed={setupMode === mode}
      onClick={() => onChangeSetupMode(mode)}
    >
      {label}
    </button>
  );
}

export function SetupModeToggle({
  onChangeSetupMode,
  setupMode,
}: Readonly<{
  onChangeSetupMode: (value: "new" | "existing") => void;
  setupMode: "new" | "existing";
}>) {
  if (!EXISTING_REPO_MODE_ENABLED) {
    return null;
  }

  return (
    <div role="group" aria-label="Setup mode" className="cp-mode-toggle">
      {(["new", "existing"] as const).map((mode) => (
        <ModeToggleButton
          key={mode}
          mode={mode}
          onChangeSetupMode={onChangeSetupMode}
          setupMode={setupMode}
        />
      ))}
    </div>
  );
}
