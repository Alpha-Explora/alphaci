"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import type { useAuthSession } from "@/features/auth/session";
import { useCapabilities } from "@/features/capabilities/current";
import { isGuest } from "@/features/auth/session";

import type { SettingsSection as SectionId } from "../../model/settings-types";
import { useSettingsViewModel } from "../view-models/use-settings-view-model";
import { SettingsAccountSection } from "./settings-account-section";
import { SettingsAppearanceSection } from "./settings-appearance-section";
import { SettingsConnectionsSection } from "./settings-connections-section";
import { SettingsDangerSection } from "./settings-danger-section";
import { SettingsGuideSection } from "./settings-guide-section";
import { SettingsTeamSection } from "./settings-team-section";
import {
  settingsContentStyle,
  settingsLayoutStyle,
} from "./settings-layout";
import { SettingsSidebar } from "./settings-sidebar";

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
  initialSection,
}: Readonly<{
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
  logoutMessage: string | null;
  prefersReducedMotion: boolean | null;
  isCompactLayout: boolean;
  onDeleted: () => void;
  /** The section a `?tab=` link asked for, read once on arrival. */
  initialSection?: SectionId;
}>) {
  const {
    capabilities,
    clientCompositionEnabled,
    workspacesEnabled,
  } = useCapabilities();
  const vm = useSettingsViewModel({
    workspacesEnabled,
    initialSection,
    appRole: session?.appRole,
  });

  const guest = isGuest(session);
  const activeSection = vm.activeSection;
  const setActiveSection = vm.setActiveSection;

  async function handleDeleteAccount() {
    if (await vm.deleteAccount()) onDeleted();
  }

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
        style={settingsLayoutStyle(isCompactLayout)}
      >
        <SettingsSidebar
          session={session}
          isCompactLayout={isCompactLayout}
          sections={vm.sections}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />

        <div
          className="settings-content"
          style={settingsContentStyle(isCompactLayout)}
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
              <SettingsSectionSwitch
                activeSection={activeSection}
                teamName={vm.teamName}
                session={session}
                prefersReducedMotion={prefersReducedMotion}
                workspacesEnabled={workspacesEnabled}
                workspaces={vm.workspaces}
                workspacesError={vm.workspacesError}
                clientComposition={
                  clientCompositionEnabled
                    ? capabilities?.clientComposition ?? null
                    : null
                }
                onLogout={onLogout}
                isLoggingOut={isLoggingOut}
                logoutMessage={logoutMessage}
                isDeleting={vm.isDeleting}
                deleteMessage={vm.deleteMessage}
                showDeleteConfirm={vm.showDeleteConfirm}
                deleteConfirmInput={vm.deleteConfirmInput}
                onBeginArchive={() => {
                  vm.setShowDeleteConfirm(true);
                  vm.clearDeleteMessage();
                  vm.setDeleteConfirmInput("");
                }}
                onChangeConfirmInput={vm.setDeleteConfirmInput}
                onConfirmArchive={() => void handleDeleteAccount()}
                onCancelArchive={() => {
                  vm.setShowDeleteConfirm(false);
                  vm.clearDeleteMessage();
                  vm.setDeleteConfirmInput("");
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function SettingsSectionSwitch(
  props: Readonly<{
    activeSection: SectionId;
    teamName: string | null;
    session: ReturnType<typeof useAuthSession>["session"];
    prefersReducedMotion: boolean | null;
    workspacesEnabled: boolean;
    workspaces: ReturnType<typeof useSettingsViewModel>["workspaces"];
    workspacesError: string | null;
    clientComposition: import("@/shared/api/contracts").ClientCompositionInfo | null;
    onLogout: () => void;
    isLoggingOut: boolean;
    logoutMessage: string | null;
    isDeleting: boolean;
    deleteMessage: string | null;
    showDeleteConfirm: boolean;
    deleteConfirmInput: string;
    onBeginArchive: () => void;
    onChangeConfirmInput: (value: string) => void;
    onConfirmArchive: () => void;
    onCancelArchive: () => void;
  }>,
) {
  if (props.activeSection === "account") {
    return (
      <SettingsAccountSection
        session={props.session}
        prefersReducedMotion={props.prefersReducedMotion}
        workspacesEnabled={props.workspacesEnabled}
        workspaces={props.workspaces}
        workspacesError={props.workspacesError}
        clientComposition={props.clientComposition}
      />
    );
  }
  if (props.activeSection === "team") {
    return <SettingsTeamSection teamName={props.teamName} />;
  }
  if (props.activeSection === "appearance") {
    return <SettingsAppearanceSection />;
  }
  if (props.activeSection === "connections") {
    return <SettingsConnectionsSection />;
  }
  if (props.activeSection === "guide") {
    return <SettingsGuideSection />;
  }
  if (props.activeSection === "danger") {
    return (
      <SettingsDangerSection
        session={props.session}
        onLogout={props.onLogout}
        isLoggingOut={props.isLoggingOut}
        logoutMessage={props.logoutMessage}
        isDeleting={props.isDeleting}
        deleteMessage={props.deleteMessage}
        showDeleteConfirm={props.showDeleteConfirm}
        deleteConfirmInput={props.deleteConfirmInput}
        onBeginArchive={props.onBeginArchive}
        onChangeConfirmInput={props.onChangeConfirmInput}
        onConfirmArchive={props.onConfirmArchive}
        onCancelArchive={props.onCancelArchive}
      />
    );
  }
  return null;
}
