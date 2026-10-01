import type { EnvTargetSlot, UsageLimitItem } from "@/shared/api/contracts";
import { isProjectNameStepReady } from "./project-name-rules";
import { toSlug } from "./workflow-studio-rules";

export function projectKindToSlot(kind?: "frontend" | "backend"): EnvTargetSlot {
  return kind === "frontend" ? "frontend" : "backend";
}

export function inferSingleProjectKind(input: {
  selectedProjectTypeKind?: "frontend" | "backend";
  selectedProjectTypeId: string;
}): "frontend" | "backend" {
  if (input.selectedProjectTypeKind) {
    return input.selectedProjectTypeKind;
  }
  const id = input.selectedProjectTypeId.toLowerCase();
  if (id.includes("next") || id.includes("react") || id.includes("frontend")) {
    return "frontend";
  }
  return "backend";
}

export function defaultProjectName(
  fallback: string,
  repoName: string,
  suffix?: string,
): string {
  if (fallback.trim()) {
    return fallback.trim();
  }
  if (!repoName.trim()) {
    return "";
  }
  return suffix ? `${repoName.trim()}-${suffix}` : repoName.trim();
}

export function isCreateDisabled(input: {
  isCreatingProject: boolean;
  projectQuotaReached: boolean;
  loadingProjectOptions: boolean;
  renderVariablesMissing: boolean;
  repoName: string;
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  hasSelectedProjectType: boolean;
}): boolean {
  if (input.isCreatingProject || input.projectQuotaReached) {
    return true;
  }
  if (input.loadingProjectOptions || input.renderVariablesMissing) {
    return true;
  }
  if (!input.repoName.trim()) {
    return true;
  }
  if (input.isMicroservicesShape || input.isMultiRepoShape) {
    return false;
  }
  return !input.hasSelectedProjectType;
}

export function isGenerateDisabled(input: {
  isCreatingProject: boolean;
  isDiscoveringExistingRepo: boolean;
  isSettingUpExistingRepo: boolean;
  loadingProjectOptions: boolean;
  hasSelectedProjectType: boolean;
  serviceName: string;
  repoName: string;
}): boolean {
  if (input.isCreatingProject || input.isDiscoveringExistingRepo || input.isSettingUpExistingRepo) {
    return true;
  }
  if (input.loadingProjectOptions || !input.hasSelectedProjectType) {
    return true;
  }
  return !(input.serviceName || input.repoName);
}

export function isExistingDiscoverDisabled(input: {
  isDiscoveringExistingRepo: boolean;
  isSettingUpExistingRepo: boolean;
  loadingProjectOptions: boolean;
  existingRepoFullName: string;
}): boolean {
  if (input.isDiscoveringExistingRepo || input.isSettingUpExistingRepo || input.loadingProjectOptions) {
    return true;
  }
  return !input.existingRepoFullName.trim();
}

export function isExistingSetupDisabled(input: {
  projectName: string;
  projectNameServerError?: string | null;
  isDiscoveringExistingRepo: boolean;
  isSettingUpExistingRepo: boolean;
  loadingProjectOptions: boolean;
  existingRepoFullName: string;
  hasSelectedProjectType: boolean;
}): boolean {
  if (isExistingDiscoverDisabled(input)) {
    return true;
  }
  if (!isProjectNameStepReady(input.projectName, input.projectNameServerError ?? null)) {
    return true;
  }
  return !input.hasSelectedProjectType;
}

export function isBlueprintReady(input: {
  selectedRepoShapeId: string;
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  backendProjectTypeId: string;
  frontendProjectTypeId: string;
  hasSelectedProjectType: boolean;
}): boolean {
  if (!input.selectedRepoShapeId) {
    return false;
  }
  if (input.isMicroservicesShape || input.isMultiRepoShape) {
    return Boolean(input.backendProjectTypeId && input.frontendProjectTypeId);
  }
  return input.hasSelectedProjectType;
}

export function isRepositoryStepReady(input: {
  /** null while the repository joins an existing Project: nothing to name. */
  projectName: string | null;
  projectNameServerError?: string | null;
  repoName: string;
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  serviceName: string;
}): boolean {
  if (!isProjectNameStepReady(input.projectName, input.projectNameServerError ?? null)) {
    return false;
  }
  if (!input.repoName.trim()) {
    return false;
  }
  if (input.isMicroservicesShape || input.isMultiRepoShape) {
    return true;
  }
  return Boolean(input.serviceName.trim());
}

export function isAutomationStepReady(outputFileName: string, nodeVersion: string): boolean {
  return Boolean(outputFileName.trim() && nodeVersion);
}

export function wizardStepReadyFlags(input: {
  blueprint: boolean;
  repository: boolean;
  automation: boolean;
  delivery: boolean;
  createReady: boolean;
}): readonly boolean[] {
  return [input.blueprint, input.repository, input.automation, input.delivery, input.createReady];
}

export function teamChoiceState(input: {
  creationScope: "choose-team" | "in-team";
  workspaceCount: number;
  selectedWorkspaceId?: string | null;
}): {
  mustChooseTeam: boolean;
  needsTeamChoice: boolean;
  hasNoTeam: boolean;
  teamChoiceMissing: boolean;
} {
  const mustChooseTeam = input.creationScope === "choose-team";
  const needsTeamChoice = mustChooseTeam && input.workspaceCount > 1;
  const hasNoTeam = mustChooseTeam && input.workspaceCount === 0;
  return {
    mustChooseTeam,
    needsTeamChoice,
    hasNoTeam,
    teamChoiceMissing: needsTeamChoice && !input.selectedWorkspaceId,
  };
}

export function filterEnforcedOrgRepos<T extends { repoFullName: string }>(
  repos: readonly T[],
  enforcedOrg: string | null | undefined,
): T[] {
  const org = enforcedOrg?.toLowerCase() ?? "";
  if (!org) {
    return [...repos];
  }
  return repos.filter((repo) => repo.repoFullName.split("/")[0]?.toLowerCase() === org);
}

export function slotProjectName(
  serviceName: string,
  repoName: string,
  suffix?: "backend" | "frontend",
): string {
  return defaultProjectName(serviceName, repoName, suffix);
}

export function effectiveDualServiceName(
  touched: boolean,
  value: string,
  repoName: string,
  suffix: "backend" | "frontend",
): string {
  if (touched) {
    return value;
  }
  if (!repoName) {
    return "";
  }
  return `${toSlug(repoName)}-${suffix}`;
}

export function findProjectQuota(items: readonly UsageLimitItem[]): UsageLimitItem | null {
  return items.find((item) => item.code === "projects") ?? null;
}

export function isProjectQuotaReached(quota: UsageLimitItem | null): boolean {
  if (!quota) {
    return false;
  }
  if (quota.limit <= 0) {
    return false;
  }
  return quota.current >= quota.limit;
}

export function hasNoLinkedRepos(input: {
  isExistingMode: boolean;
  linkedReposLoaded: boolean;
  loadingLinkedRepos: boolean;
  linkedRepoCount: number;
}): boolean {
  if (!input.isExistingMode) {
    return false;
  }
  if (!input.linkedReposLoaded) {
    return false;
  }
  if (input.loadingLinkedRepos) {
    return false;
  }
  return input.linkedRepoCount === 0;
}

export function isFinalCreateDisabled(input: {
  createDisabled: boolean;
  teamChoiceMissing: boolean;
  priorStepsReady: boolean;
}): boolean {
  if (input.createDisabled) {
    return true;
  }
  if (input.teamChoiceMissing) {
    return true;
  }
  return !input.priorStepsReady;
}

export function countWorkspaces(workspaces?: { length: number } | null): number {
  if (!workspaces) {
    return 0;
  }
  return workspaces.length;
}

export function soleWorkspaceOf<T>(
  mustChooseTeam: boolean,
  workspaces?: readonly T[] | null,
): T | null {
  if (!mustChooseTeam) {
    return null;
  }
  if (!workspaces || workspaces.length !== 1) {
    return null;
  }
  return workspaces[0] ?? null;
}

/** Only offer shapes users can actually pick — hides "coming soon" catalog entries (e.g. monorepo). */
export function isOfferedRepoShape(shape: { enabled: boolean; id: string }): boolean {
  return shape.enabled && shape.id !== "monorepo";
}

export function repoPrefixedPlaceholder(
  repoName: string,
  suffix: string,
  emptyFallback: string,
): string {
  if (!repoName) {
    return emptyFallback;
  }
  return `${repoName}-${suffix}`;
}

export function githubOrgLogin(accountLogin?: string | null): string {
  if (!accountLogin) {
    return "ALPHACI";
  }
  return accountLogin;
}

export function canSelectWizardStep(
  step: number,
  furthestStep: number,
  ready: readonly boolean[],
): boolean {
  if (step > furthestStep) {
    return false;
  }
  return ready.slice(0, step).every(Boolean);
}

export function nextWizardStep(activeStep: number, stepCount: number): number {
  return Math.min(stepCount - 1, activeStep + 1);
}

export function selectedShapeLabel(
  shapes: readonly { id: string; label: string }[],
  selectedId: string,
): string {
  const match = shapes.find((shape) => shape.id === selectedId);
  if (!match) {
    return "Selected shape";
  }
  return match.label;
}

export function catalogTypeLabel(
  types: readonly { id: string; label: string }[],
  selectedId: string,
): string | undefined {
  return types.find((item) => item.id === selectedId)?.label;
}
