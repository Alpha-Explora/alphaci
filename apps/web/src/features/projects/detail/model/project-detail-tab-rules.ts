import type {
  AppRole,
  DeploymentTarget,
  DeploymentTargetSyncResponse,
  DetachDeploymentTargetResponse,
  EnvVarMetadata,
  ProjectOverviewResponse,
  ReinstallDeploymentSecretsResponse,
  WorkflowFileMetadata,
  WorkflowSettings,
} from "@/shared/api/contracts";

export type ProjectDetailTab =
  | "overview"
  | "code"
  | "pulls"
  | "checklists"
  | "runs"
  | "workflow"
  | "hosting"
  | "environment"
  | "qa"
  | "po"
  | "audit"
  | "settings";

/** Every tab, in strip order. */
export const PROJECT_DETAIL_TABS: ReadonlyArray<ProjectDetailTab> = [
  "overview",
  "code",
  "pulls",
  "checklists",
  "runs",
  "workflow",
  "hosting",
  "environment",
  "qa",
  "po",
  "audit",
  "settings",
];

/**
 * The roles QA Studio is for: the QA Team, who verify the uat build against
 * the Project's requirements and sign it off, and admins. Developers read the
 * requirements and fix what QA returns (the "My QA items" list the Overview
 * summarises); they do not test in a studio.
 */
export const QA_STUDIO_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["qa", "admin"]);

/**
 * The roles PO Studio is for: Product owners, who accept the whole system on
 * uat once QA signed it off and merge it to main, and admins.
 */
export const PO_STUDIO_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["lead", "admin"]);

export function canOpenQaStudio(appRole: AppRole | null | undefined): boolean {
  return appRole != null && QA_STUDIO_ROLES.has(appRole);
}

export function canOpenPoStudio(appRole: AppRole | null | undefined): boolean {
  return appRole != null && PO_STUDIO_ROLES.has(appRole);
}

export type StudioTab = Extract<ProjectDetailTab, "qa" | "po">;

/**
 * The studio a viewer works in: the QA Team's QA Studio, a Product owner's PO
 * Studio; an admin has both and lands on QA Studio. Null for everyone else.
 *
 * Exported: notification deep links and the Pull requests tab's "merges to
 * main go through the studio" notice point the viewer at their own studio
 * (a Developer, who has none, gets the notice without the link).
 */
export function studioTabFor(appRole: AppRole | null | undefined): StudioTab | null {
  if (canOpenQaStudio(appRole)) return "qa";
  if (canOpenPoStudio(appRole)) return "po";
  return null;
}

/**
 * The roles that judge a Project as one product rather than as repositories:
 * the QA Team and Product owners. Their page has no FRONTEND / BACKEND switch,
 * opens on the Project's frontend, and carries its five tabs in the title row.
 *
 * Named rather than derived (`!== "member"`): a role added later gets the
 * Developer's page — more navigation, never more power — until it is listed.
 */
const PRODUCT_VIEW_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["qa", "lead"]);

export function seesProjectAsProduct(appRole: AppRole | null | undefined): boolean {
  return appRole != null && PRODUCT_VIEW_ROLES.has(appRole);
}

/**
 * Whether the Checklists tab IS the Project's QA workspace (Requirements, QA
 * run, My QA items). True for every role, whenever the repository is filed
 * under a Project: Developers and Admins work from the same workspace the QA
 * Team and Product owners do, and nothing on the page links away to the
 * Projects page. Any other scope (no Project, or one that could not be read,
 * as on an older backend) keeps the per-repository screens; `pending` shows
 * those until the Project is known, as the tab always did.
 */
export function checklistsTabCarriesProjectQa(qaScopeKind: "pending" | "project" | "repository"): boolean {
  return qaScopeKind === "project";
}

/**
 * Developers and Admins — the backend's environment-variable allow-list
 * (refusal code `ENV_VARS_LEAD_ONLY`, a legacy name) for the Environment tab
 * and its list/create/update/delete routes. Product owners (`lead`) and QA
 * Team are refused.
 */
const ENV_VARS_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["member", "admin"]);

export function canManageEnvVars(appRole: AppRole | null | undefined): boolean {
  return appRole != null && ENV_VARS_ROLES.has(appRole);
}

/**
 * Developers get the read-only "Ready for production" card on the Overview:
 * they have no studio, where Product owners (PO Studio) and the QA Team (QA
 * Studio) see it. Needs the QA
 * capability, like the card itself.
 */
export function showOverviewProductionReadiness(
  appRole: AppRole | null | undefined,
  qaChecklistsEnabled: boolean,
): boolean {
  return qaChecklistsEnabled && appRole === "member";
}

/**
 * Team leads and Admins — the backend's `PROJECT_ROLE_FORBIDDEN` allow-list
 * for disconnecting/deleting a project (PERSONA_WORKFLOW_SPEC.md §3, §8.1).
 *
 * Reinstalling deployment secrets used to share this list; it follows the
 * hosting rule now (`canReinstallDeploymentSecrets` below).
 */
const PROJECT_LIFECYCLE_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["lead", "admin"]);

export function canManageProjectLifecycle(
  appRole: AppRole | null | undefined,
): boolean {
  return appRole != null && PROJECT_LIFECYCLE_ROLES.has(appRole);
}

/**
 * Developers and Admins — the backend's hosting allow-list (refusal code
 * `HOSTING_LEAD_ONLY`, a legacy name) for creating, changing, syncing and
 * detaching deployment targets and for adding, verifying and removing custom
 * domains. Product owners (`lead`) and QA Team are refused. Listing stays open
 * to anyone who can see the project.
 */
const HOSTING_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["member", "admin"]);

export function canManageHosting(appRole: AppRole | null | undefined): boolean {
  return appRole != null && HOSTING_ROLES.has(appRole);
}

/** Shown where a hosting mutation control would otherwise be. */
export const HOSTING_LEAD_ONLY_NOTE =
  "Developers and admins can change hosting services and custom domains.";

/** Every tab except the ones a role is never offered. */
function allTabsExcept(
  ...hidden: ReadonlyArray<ProjectDetailTab>
): ReadonlySet<ProjectDetailTab> {
  return new Set(PROJECT_DETAIL_TABS.filter((tab) => !hidden.includes(tab)));
}

/**
 * The tabs each role may be offered, before the capability flags below.
 * An allow-list: a role added later gets only the unknown-role list until it
 * is named here.
 *
 *   - Product owner (`lead`): what they own — the Overview, the Project's
 *     requirements (Checklists), PO Studio (accepting the system on uat and
 *     merging it to main), the Audit trail and Settings. No code, pipeline,
 *     hosting or environment surfaces.
 *   - Developer (`member`): everything except the studios, Environment
 *     included (they change hosting and variables now).
 *   - QA Team (`qa`): the same five with QA Studio in place of PO Studio. QA
 *     checks the uat build and its UI there; code, pipeline, hosting and
 *     environment surfaces are not theirs.
 *   - Admin: everything, both studios included.
 */
const OWNER_TABS: ReadonlySet<ProjectDetailTab> = new Set<ProjectDetailTab>([
  "overview",
  "checklists",
  "po",
  "audit",
  "settings",
]);

const QA_TEAM_TABS: ReadonlySet<ProjectDetailTab> = new Set<ProjectDetailTab>([
  "overview",
  "checklists",
  "qa",
  "audit",
  "settings",
]);

const ROLE_TABS: Readonly<Record<AppRole, ReadonlySet<ProjectDetailTab>>> = {
  lead: OWNER_TABS,
  member: allTabsExcept("qa", "po"),
  qa: QA_TEAM_TABS,
  admin: allTabsExcept(),
};

/**
 * No known role (a session still resolving, or an older backend): the tabs
 * every signed-in viewer had before roles, never a role-gated one.
 */
const UNKNOWN_ROLE_TABS: ReadonlySet<ProjectDetailTab> = allTabsExcept(
  "checklists",
  "qa",
  "po",
  "environment",
);

/** The role's allow-list. */
export function projectDetailTabsForRole(
  appRole: AppRole | null | undefined,
): ReadonlySet<ProjectDetailTab> {
  if (appRole == null) return UNKNOWN_ROLE_TABS;
  return ROLE_TABS[appRole] ?? UNKNOWN_ROLE_TABS;
}

/** Checklists and the studios exist only with the QA checklists capability. */
const QA_CAPABILITY_TABS: ReadonlySet<ProjectDetailTab> = new Set<ProjectDetailTab>([
  "checklists",
  "qa",
  "po",
]);

/**
 * The tabs this viewer gets, in strip order: the role's allow-list
 * (`projectDetailTabsForRole`), minus Checklists and QA Studio while the
 * backend does not report `qaChecklistsEnabled`.
 */
export function visibleProjectDetailTabs(
  appRole: AppRole | null | undefined,
  flags: Readonly<{ qaChecklistsEnabled: boolean }>,
): ProjectDetailTab[] {
  const allowed = projectDetailTabsForRole(appRole);
  return PROJECT_DETAIL_TABS.filter(
    (tab) => allowed.has(tab) && (flags.qaChecklistsEnabled || !QA_CAPABILITY_TABS.has(tab)),
  );
}

/**
 * The tab a deep link asks for: `/projects/:id#qa` opens QA Studio. Unknown or
 * empty hashes give null (start on Overview). Visibility is still decided by
 * `resolveVisibleTab`, so a link can never reveal a gated tab.
 */
export function tabFromHash(hash: string | null | undefined): ProjectDetailTab | null {
  const id = (hash ?? "").replace(/^#/, "");
  return (PROJECT_DETAIL_TABS as ReadonlyArray<string>).includes(id) ? (id as ProjectDetailTab) : null;
}

/**
 * A notification deep-link asks the Overview to scroll to and briefly
 * highlight the "My QA items" card: `?focus=my-qa-items`. Read once at mount
 * from `location.search` (mirrors `tabFromHash` above) rather than
 * `useSearchParams`, so this VM does not force the route into dynamic
 * rendering just to read one query flag.
 */
export function shouldHighlightMyQaItems(search: string | null | undefined): boolean {
  if (!search) return false;
  return new URLSearchParams(search).get("focus") === "my-qa-items";
}

/** Each studio's counterpart: a link to one lands a viewer without it on the other. */
const OTHER_STUDIO: Readonly<Partial<Record<ProjectDetailTab, StudioTab>>> = { qa: "po", po: "qa" };

/**
 * The selected tab, or Overview when the selection is not (or no longer)
 * visible. A studio the viewer lacks opens their own studio instead: links
 * written before PO Studio (`#qa` from a notification, a report's "back to
 * QA Studio", the Projects explorer) still bring a Product owner to theirs.
 */
export function resolveVisibleTab(
  tab: ProjectDetailTab,
  visible: ReadonlyArray<ProjectDetailTab>,
): ProjectDetailTab {
  if (visible.includes(tab)) return tab;
  const other = OTHER_STUDIO[tab];
  return other && visible.includes(other) ? other : "overview";
}

export const COVERAGE_THRESHOLD_OPTIONS: Array<{ value: string; label: string }> =
  [
    { value: "0", label: "None (0%)" },
    { value: "60", label: "Basic (60%)" },
    { value: "80", label: "Standard (80%)" },
    { value: "90", label: "Strict (90%)" },
    { value: "100", label: "Full (100%)" },
  ];

export const WORKFLOW_CHECK_OPTIONS: Array<{
  key: keyof WorkflowSettings["checks"];
  label: string;
}> = [
  { key: "lint", label: "Lint" },
  { key: "unit", label: "Unit tests" },
  { key: "build", label: "Build" },
  { key: "security", label: "Security" },
];

export function projectQueryStatus(
  hasData: boolean,
  error: string | null,
): "loading" | "ready" | "error" {
  if (hasData) return "ready";
  if (error) return "error";
  return "loading";
}

export function configuredOrNot(value: string | null | undefined): string {
  return value ?? "Not configured";
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed;
}

export function overviewCapabilityFlags(
  overview: ProjectOverviewResponse | null | undefined,
): {
  workflowSettings: boolean | undefined;
  ciRunTracking: boolean | undefined;
  deploymentHistory: boolean | undefined;
} {
  const caps = overview?.capabilities;
  return {
    workflowSettings: caps?.workflowSettings,
    ciRunTracking: caps?.ciRunTracking,
    deploymentHistory: caps?.deploymentHistory,
  };
}

export function overviewTabData(
  overview: ProjectOverviewResponse | null | undefined,
  workflowFilesFallback: WorkflowFileMetadata[] | null | undefined,
): {
  workflowFiles: WorkflowFileMetadata[];
  deploymentTargets: DeploymentTarget[];
  envMetadata: EnvVarMetadata[];
} {
  const files = overview?.workflow.files ?? workflowFilesFallback;
  return {
    workflowFiles: files ?? [],
    deploymentTargets: overview?.deploymentTargets.items ?? [],
    envMetadata: overview?.environment.items ?? [],
  };
}

export function isCiRunsQueryEnabled(input: {
  tab: ProjectDetailTab;
  ciRunTrackingEnabled: boolean;
  overviewCiRunTracking: boolean | undefined;
}): boolean {
  return (
    input.tab === "runs" &&
    input.ciRunTrackingEnabled &&
    input.overviewCiRunTracking === true
  );
}

export function isDeploymentsQueryEnabled(input: {
  tab: ProjectDetailTab;
  deploymentHistoryEnabled: boolean;
  overviewDeploymentHistory: boolean | undefined;
}): boolean {
  return (
    input.tab === "hosting" &&
    input.deploymentHistoryEnabled &&
    input.overviewDeploymentHistory === true
  );
}

export function isWorkflowSettingsQueryEnabled(input: {
  tab: ProjectDetailTab;
  workflowSettingsPreviewEnabled: boolean;
  overviewWorkflowSettings: boolean | undefined;
}): boolean {
  return (
    input.tab === "workflow" &&
    input.workflowSettingsPreviewEnabled &&
    input.overviewWorkflowSettings === true
  );
}

export function snapshotFindingLabel(count: number): string {
  return `${count} finding${count === 1 ? "" : "s"}`;
}

export function hostingProviderLabel(provider: string): string {
  if (provider === "render") return "Render backend";
  return "Vercel frontend";
}

export function envMetadataLaneLabel(item: EnvVarMetadata): string {
  if (item.lane === "production") return "production";
  return `preview: ${item.gitBranch}`;
}

export function ciRunRowClass(conclusion: string | null): string {
  if (conclusion === "failure") return "failed";
  return "provisioned";
}

export function deploymentRowClass(status: string): string {
  if (status === "failed") return "failed";
  return "provisioned";
}

export function previewDiffBadgeClass(status: string): string {
  if (status === "changed") return "dash-badge-violet";
  return "branch-chip";
}

export function coverageHasPreset(threshold: number): boolean {
  const value = String(threshold);
  return COVERAGE_THRESHOLD_OPTIONS.some((option) => option.value === value);
}

export function centralRefIsListed(tags: string[], ref: string): boolean {
  return tags.includes(ref);
}

export function targetSyncLabel(syncing: boolean): string {
  if (syncing) return "Syncing…";
  return "Sync";
}

export function logsToggleLabel(open: boolean): string {
  if (open) return "Hide Logs";
  return "Logs";
}

export function detachButtonLabel(detaching: boolean, confirming: boolean): string {
  if (detaching) return "Detaching…";
  if (confirming) return "Confirm detach";
  return "Detach";
}

export function saveMetadataLabel(saving: boolean): string {
  if (saving) return "Saving...";
  return "Save metadata";
}

export function previewWorkflowLabel(previewing: boolean): string {
  if (previewing) return "Previewing...";
  return "Preview";
}

/** Shown in place of the update-PR button for roles the backend refuses (QA). */
export const UPDATE_PR_ROLE_NOTE =
  "A Developer, Team lead or admin can open the workflow update pull request.";

/** The backend targets dev, else uat — never main. */
export const UPDATE_PR_TARGET_NOTE =
  "Opens a pull request into dev (or uat when there is no dev branch).";

export function createUpdatePrLabel(creating: boolean): string {
  if (creating) return "Creating...";
  return "Create update PR";
}

export function targetSyncMessage(response: DeploymentTargetSyncResponse): string {
  const findingCount = response.findings.length;
  if (response.mode === "provider_live") {
    return liveSyncMessage(findingCount);
  }
  return localSyncMessage(findingCount, liveCheckUnavailable(response));
}

function liveSyncMessage(findingCount: number): string {
  if (findingCount) {
    return `Live status check completed with ${snapshotFindingLabel(findingCount)}.`;
  }
  return "Live status check completed.";
}

function localSyncMessage(findingCount: number, liveCheckFailed: boolean): string {
  const suffix = liveCheckFailed ? " (live check unavailable)" : "";
  if (findingCount) {
    return `Local metadata sync completed with ${snapshotFindingLabel(findingCount)}.${suffix}`;
  }
  return `Local metadata sync completed.${suffix}`;
}

function liveCheckUnavailable(response: DeploymentTargetSyncResponse): boolean {
  return response.findings.some(
    (finding) => finding.code === "provider_live_check_failed",
  );
}

export function targetDetachMessage(
  response: DetachDeploymentTargetResponse,
  target: DeploymentTarget,
): string {
  if (response.providerResourceDeleted) {
    return `Target detached from ALPHACI and the ${target.provider} resource was deleted.`;
  }
  if (response.providerDeleteError) {
    return detachProviderErrorMessage(response.providerDeleteError, target);
  }
  return "Target detached from ALPHACI. Provider resource was not deleted.";
}

function detachProviderErrorMessage(
  providerDeleteError: string,
  target: DeploymentTarget,
): string {
  const dashboard = target.dashboardUrl ? ` (${target.dashboardUrl})` : "";
  return `Target detached from ALPHACI, but the ${target.provider} resource could not be deleted automatically (${providerDeleteError}). Delete it manually from the provider dashboard${dashboard}.`;
}

export function replaceDeploymentTarget(
  overview: ProjectOverviewResponse,
  target: DeploymentTarget,
): ProjectOverviewResponse {
  const items = overview.deploymentTargets.items.map((item) =>
    item.id === target.id ? target : item,
  );
  return {
    ...overview,
    deploymentTargets: {
      ...overview.deploymentTargets,
      items,
    },
  };
}

export function upsertDeploymentTarget(
  overview: ProjectOverviewResponse,
  target: DeploymentTarget,
): ProjectOverviewResponse {
  const exists = overview.deploymentTargets.items.some(
    (item) => item.id === target.id,
  );
  const items = exists
    ? overview.deploymentTargets.items.map((item) =>
        item.id === target.id ? target : item,
      )
    : [target, ...overview.deploymentTargets.items];
  return {
    ...overview,
    deploymentTargets: {
      ...overview.deploymentTargets,
      items,
      count: items.length,
    },
  };
}

export function removeDeploymentTarget(
  overview: ProjectOverviewResponse,
  targetId: string,
): ProjectOverviewResponse {
  const items = overview.deploymentTargets.items.filter(
    (item) => item.id !== targetId,
  );
  return {
    ...overview,
    deploymentTargets: {
      ...overview.deploymentTargets,
      items,
      count: items.length,
    },
  };
}

export function applyTargetChange(
  current: ProjectOverviewResponse | null,
  projectId: string,
  target: DeploymentTarget,
): ProjectOverviewResponse | null {
  if (!current || current.project.id !== projectId) return current;
  return replaceDeploymentTarget(current, target);
}

export function applyTargetCreated(
  current: ProjectOverviewResponse | null,
  projectId: string,
  target: DeploymentTarget,
): ProjectOverviewResponse | null {
  if (!current || current.project.id !== projectId) return current;
  return upsertDeploymentTarget(current, target);
}

export function applyTargetDetached(
  current: ProjectOverviewResponse | null,
  projectId: string,
  targetId: string,
): ProjectOverviewResponse | null {
  if (!current || current.project.id !== projectId) return current;
  return removeDeploymentTarget(current, targetId);
}

/* ── Reinstall deployment secrets ────────────────────────────────────────── */

/**
 * Reinstalling a target's secrets follows the hosting rule (Developers and
 * Admins, `canManageHosting`), as the backend does; Product owners and QA
 * Team never see the button.
 */
export function canReinstallDeploymentSecrets(
  appRole: AppRole | null | undefined,
): boolean {
  return canManageHosting(appRole);
}

export function reinstallSecretsLabel(reinstalling: boolean): string {
  if (reinstalling) return "Reinstalling…";
  return "Reinstall deployment secrets";
}

/** Every string value in a loosely-typed record, in insertion order. */
function stringValues(
  record: Record<string, unknown> | null | undefined,
): string[] {
  if (!record) return [];
  return Object.values(record).filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

/**
 * The secret and variable names the server (re)wrote, read defensively: a
 * response missing either field still renders a calm confirmation instead of
 * throwing.
 */
export function reinstallSecretsSuccessMessage(
  response: Partial<
    Pick<ReinstallDeploymentSecretsResponse, "githubSecrets" | "githubVariables">
  >,
): string {
  const names = [
    ...stringValues(response.githubSecrets),
    ...stringValues(response.githubVariables),
  ];
  if (!names.length) return "Deployment secrets reinstalled.";
  return `Deployment secrets reinstalled: ${names.join(", ")}.`;
}

export interface ReinstallSecretsFailure {
  message: string;
  /** Set only for a 401: where the "Sign in again" link should point. */
  signInHref: string | null;
}

function reinstallErrorStatus(cause: unknown): number | null {
  const status = (cause as { status?: unknown } | null | undefined)?.status;
  return typeof status === "number" ? status : null;
}

function reinstallErrorDetails(cause: unknown): unknown {
  return (cause as { details?: unknown } | null | undefined)?.details;
}

/** The raw `message` a JSON error body carries — a string, a validator array, or absent. */
function messageFromDetails(details: unknown): unknown {
  if (typeof details === "string") return details;
  if (typeof details !== "object" || details === null || !("message" in details)) {
    return null;
  }
  return (details as { message?: unknown }).message;
}

function normalizeMessageText(message: unknown): string | null {
  if (typeof message === "string") return message.trim() || null;
  if (!Array.isArray(message)) return null;
  const joined = message
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .trim();
  return joined || null;
}

function reinstallErrorServerMessage(cause: unknown): string | null {
  return normalizeMessageText(messageFromDetails(reinstallErrorDetails(cause)));
}

/** Where "Sign in again" goes: login, then back to this project. */
export function reinstallSecretsSignInHref(projectId: string): string {
  return `/login?next=/projects/${encodeURIComponent(projectId)}`;
}

/**
 * What to show for a failed reinstall. 401 means the stored GitHub token is
 * gone or stale (the server's own message says as much) — surfaced with a
 * sign-in link rather than the raw server text. 403 is the role gate itself
 * somehow being wrong (stale UI). Anything else, including 400, shows the
 * server's own reason (e.g. "vercel has no CI secrets to reinstall...").
 */
export function reinstallSecretsFailure(
  cause: unknown,
  projectId: string,
): ReinstallSecretsFailure {
  const status = reinstallErrorStatus(cause);
  if (status === 401) {
    return {
      message:
        "GitHub needs you to sign in again before ALPHACI can reinstall this target's secrets.",
      signInHref: reinstallSecretsSignInHref(projectId),
    };
  }
  if (status === 403) {
    return {
      message: "Only Developers and admins can reinstall deployment secrets.",
      signInHref: null,
    };
  }
  return {
    message:
      reinstallErrorServerMessage(cause) ??
      "Unable to reinstall deployment secrets. Try again in a moment.",
    signInHref: null,
  };
}
