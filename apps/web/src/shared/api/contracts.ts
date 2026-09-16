export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active" | "canceled";
export type EnvProvider = "render" | "vercel";
/**
 * Render's own environment naming on a deployment target. NOT the env-var lane
 * — that is EnvLane. The two used to be one type, which made a Render service
 * name and an environment-variable scope move together.
 */
export type EnvEnvironment = "test" | "uat" | "production";

/**
 * Deployment lane an environment variable applies to.
 *
 * `production` is the lane the provider's production branch deploys to and
 * carries no branch of its own; `preview` is always scoped to one branch, which
 * is what gives every branch its own set of values.
 */
export type EnvLane = "production" | "preview";

/** A lane paired with its branch. gitBranch is null exactly when lane is production. */
export interface EnvVarScope {
  lane: EnvLane;
  gitBranch: string | null;
}
export type EnvOwnershipMode = "byo" | "flowci_managed";
export type EnvTargetSlot = "backend" | "frontend" | "standalone";
export type DeploymentStrategy =
  | "provider_native"
  | "vercel_git_connected"
  | "vercel_ci_pushed"
  | "render_git_connected"
  | "render_image_pushed"
  | "render_existing_service";
export type RenderServiceType =
  "web_service" | "private_service" | "background_worker" | "cron_job";
export type RenderRuntime =
  "node" | "python" | "ruby" | "go" | "rust" | "elixir" | "docker";
export type RenderDeployMethod =
  "managed_image" | "byo_image" | "native_git" | "existing_service";

export interface SessionUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
  email?: string;
  onboardingCompleted: boolean;
  /**
   * True when the user is a member of the internal company GitHub org.
   * Internal users bypass the subscription/payment gate entirely. Optional so
   * older cached sessions (pre-rollout) deserialize safely.
   */
  isInternal?: boolean;
}

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: "mock" | "supabase" | "manual" | "paymongo";
  updatedAt: string;
  planCode?: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  amountPhp?: number;
  interval?: "month" | "year";
}

export type PlatformRole = "admin" | "super_admin";

/** Global hierarchy role — the single source of truth for create capabilities. */
export type AppRole = "admin" | "lead" | "member";

/** Provenance of {@link AppRole} — see AuthMeResponse.appRoleSource. */
export type AppRoleSource = "github_team" | "manual";

/**
 * User-facing labels for the global role. These mirror the GitHub org teams
 * that drive them (`team-lead` / `developers`), so what a user sees in the app
 * matches what they were added to in GitHub.
 */
export const APP_ROLE_BADGE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  lead: "Team lead",
  member: "Developer",
};

export interface AuthMeResponse {
  authenticated: boolean;
  user: SessionUser;
  subscription: SubscriptionInfo;
  /** null for ordinary users; set for platform admins. Gates the /admin surface. */
  platformRole?: PlatformRole | null;
  /**
   * Global hierarchy role ('admin' | 'lead' | 'member'). Gates create actions
   * (systems/repositories) in the Groups UI — only admin/lead may create.
   * Optional so older cached sessions deserialize safely (defaults to 'member').
   */
  appRole?: AppRole;
  /**
   * Where `appRole` came from. 'github_team' means it follows the GitHub org
   * teams (`team-lead` / `developers`) and can change on the next sign-in;
   * 'manual' means an admin pinned it in the Console and automatic sync skips
   * this user. Optional so older cached sessions deserialize safely.
   */
  appRoleSource?: AppRoleSource;
}

export interface CapabilitiesResponse {
  envProvisioning: {
    enabled: boolean;
    providers: EnvProvider[];
    environments: EnvEnvironment[];
    modes: EnvOwnershipMode[];
  };
  projectSyncSnapshots: {
    enabled: boolean;
    liveGithubEnabled?: boolean;
    liveProvidersEnabled?: boolean;
    mode: "local_snapshot";
  };
  workflowSettingsPreview: {
    enabled: boolean;
  };
  workflowUpdatePr: {
    enabled: boolean;
  };
  projectTargetManagement?: {
    enabled: boolean;
  };
  ciRunTracking?: {
    enabled: boolean;
    liveGithubEnabled: boolean;
    mode: "local_mock";
  };
  deploymentHistory?: {
    enabled: boolean;
    liveProvidersEnabled: boolean;
    mode: "local_mock";
  };
  previewDeployments?: {
    enabled: boolean;
    /** Providers that report a preview lane. Vercel-only today. */
    providers: readonly string[];
  };
  driftDetection?: {
    enabled: boolean;
    liveProviderChecksEnabled?: boolean;
    mode: "local_snapshot";
  };
  driftRepair?: {
    enabled: boolean;
    liveRepairEnabled?: boolean;
    mode: "local_safe";
  };
  usageQuotas?: {
    enabled: boolean;
  };
  workspaces?: {
    enabled: boolean;
  };
  auditEvents?: {
    enabled: boolean;
  };
  notifications?: {
    enabled: boolean;
  };
  /**
   * Groups / Systems / Delivery Projects / Repositories / Assignments surface
   * (HIERARCHY_IMPLEMENTATION_PLAN.md §3.2). Gates the Groups + My work nav and
   * dashboards without a separate endpoint, consistent with `workspaces.enabled`.
   * `githubSyncMode` mirrors HIERARCHY_GITHUB_SYNC_MODE (stub|live).
   */
  hierarchy?: {
    enabled: boolean;
    githubSyncMode: "stub" | "live";
  };
}

export interface ProviderConnection {
  id: string;
  provider: EnvProvider;
  label: string;
  tokenLastFour: string;
  status: "active" | "revoked" | "failed";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface CreateProviderConnectionRequest {
  provider: EnvProvider;
  label: string;
  token: string;
  vercelTeamId?: string;
  vercelTeamSlug?: string;
}

export interface DeploymentTarget {
  id: string;
  projectId: string;
  slot: EnvTargetSlot;
  ownershipMode: EnvOwnershipMode;
  provider: EnvProvider;
  providerConnectionId: string | null;
  providerProjectId: string;
  providerProjectName: string;
  repoFullName: string;
  branchName: string;
  rootDirectory: string | null;
  buildCommand: string | null;
  startCommand: string | null;
  renderServiceType?: RenderServiceType | null;
  renderRuntime?: RenderRuntime | null;
  renderInstanceType?: string | null;
  renderRegion?: string | null;
  renderEnvironmentName?: EnvEnvironment | null;
  dockerContext?: string | null;
  dockerfilePath?: string | null;
  imageUrl?: string | null;
  environmentMap: Record<string, unknown>;
  deploymentStrategy?: DeploymentStrategy;
  providerMetadata?: Record<string, unknown>;
  status: "active" | "missing" | "failed";
  /** Live service URL (e.g. https://demo-backend-main.onrender.com), computed by the BE. */
  publicUrl?: string | null;
  /** Provider dashboard URL, computed by the BE. */
  dashboardUrl?: string | null;
}

export interface CreateDeploymentTargetRequest {
  action: "create" | "register_existing";
  slot: EnvTargetSlot;
  ownershipMode: EnvOwnershipMode;
  provider: EnvProvider;
  providerConnectionId?: string;
  providerProjectId?: string;
  providerProjectName?: string;
  projectName?: string;
  branchName?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  renderDeployMethod?: RenderDeployMethod;
  renderServiceType?: RenderServiceType;
  renderRuntime?: RenderRuntime;
  renderInstanceType?: string;
  renderRegion?: string;
  renderEnvironmentName?: EnvEnvironment;
  dockerContext?: string;
  dockerfilePath?: string;
  imageUrl?: string;
  environmentMap?: Record<string, unknown>;
}

export interface UpdateDeploymentTargetRequest {
  slot?: EnvTargetSlot;
  providerProjectName?: string;
  branchName?: string;
  rootDirectory?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  renderEnvironmentName?: EnvEnvironment | null;
}

export interface DeploymentTargetSyncResponse {
  mode: "provider_live" | "local_metadata";
  status: DeploymentTarget["status"];
  findings: Array<{
    code: string;
    severity: "warning" | "error";
    message: string;
  }>;
  target: DeploymentTarget;
}

export interface DetachDeploymentTargetRequest {
  deleteProviderResource?: boolean;
}

export interface DisconnectProjectRequest {
  deleteGithubRepo?: boolean;
  confirmRepoName?: string;
  /** Also delete the live Render/Vercel resources behind the project's targets. */
  deleteProviderResources?: boolean;
  /** Also delete the project's SonarCloud project. */
  deleteSonarProject?: boolean;
}

/**
 * A completed disconnect.
 *
 * Only ever a success. When GitHub, Render/Vercel or SonarCloud refuses a
 * requested deletion the project is kept and the request fails with 409, whose body carries `code`
 * and a `message` written for the user - read it with apiErrorReason.
 */
export interface DisconnectProjectResponse {
  ok: boolean;
  githubRepoDeleted?: boolean;
  /** Live Render/Vercel resources deleted; present only when requested. */
  providerResourcesDeleted?: number;
  /** Present only when requested: false when there was no SonarCloud project. */
  sonarProjectDeleted?: boolean;
}

export interface DetachDeploymentTargetResponse {
  detached: true;
  providerResourceDeleted: boolean;
  providerDeleteError?: string;
}

export interface DeploymentTargetActionsResponse {
  targetId: string;
  provider: EnvProvider;
  actions: {
    sync: {
      enabled: boolean;
      mode: "local_metadata";
    };
    detach: {
      enabled: boolean;
    };
    reinstallDeploymentSecrets: {
      enabled: boolean;
      reason?: string;
    };
    openProviderDashboard: {
      enabled: boolean;
      url: string | null;
    };
    openProviderConsole: {
      enabled: boolean;
      url: string | null;
    };
  };
}

export interface EnvVarMetadata {
  id: string;
  projectId: string;
  deploymentTargetId: string;
  lane: EnvLane;
  /** Null exactly when `lane` is production. */
  gitBranch: string | null;
  key: string;
  provider: EnvProvider;
  valueStored: false;
  lastProvisionedAt: string;
  lastProvisionedBy: string;
  status: "provisioned" | "failed";
  errorSummary: string | null;
  removedAt?: string | null;
}

export interface ProvisionEnvVarsRequest {
  deploymentTargetId: string;
  lane: EnvLane;
  /** Required for the preview lane; rejected for production. */
  gitBranch?: string | null;
  vars: Array<{ key: string; value: string }>;
}

export interface ProvisionEnvVarsResponse {
  provisioned: Array<{ key: string; status: "provisioned" }>;
  failed: Array<{ key: string; status: "failed"; errorSummary: string }>;
}

export interface ValidateEnvVarsRequest {
  deploymentTargetId: string;
  lane: EnvLane;
  gitBranch?: string | null;
  text: string;
}

export interface ValidateEnvVarsResponse {
  keyCount: number;
  keys: string[];
  duplicates: string[];
  invalidKeys: string[];
  warnings: Array<{ code: string; message: string }>;
}

/**
 * One DNS record the provider says must exist before a hostname will serve.
 * Passed through from the provider verbatim — never generated locally, so the
 * instructions cannot go stale when the provider changes them.
 */
export interface DomainVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface CustomDomain {
  id: string;
  projectId: string;
  deploymentTargetId: string;
  provider: EnvProvider;
  hostname: string;
  apexDomain: string | null;
  /** Branch this hostname serves. Null for the production domain. */
  gitBranch: string | null;
  verified: boolean;
  verification: DomainVerificationChallenge[];
  /**
   * Whether DNS points at the provider. Null until checked once, and separate
   * from `verified`: a domain can be verified as owned and still not pointed
   * at the deployment.
   */
  misconfigured: boolean | null;
  lastCheckedAt: string | null;
  lastErrorSafeMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddCustomDomainRequest {
  deploymentTargetId: string;
  hostname: string;
  /** Omitted means the production domain. */
  gitBranch?: string | null;
}

export interface RemoveCustomDomainResponse {
  removed: true;
  hostname: string;
  /** Set when the local row was removed but the provider call failed. */
  providerError: string | null;
}

export interface DeleteEnvVarMetadataResponse {
  removed: true;
  key: string;
}

export interface DeploymentProvisioningEnvSet {
  lane: EnvLane;
  /** Omitted on preview means "the branch this target tracks". */
  gitBranch?: string;
  vars: Array<{ key: string; value: string }>;
}

export interface DeploymentProvisioningVariableGroup {
  name?: string;
  provider: EnvProvider;
  appliesTo?: "all" | "selected";
  targetBranches?: string[];
  env: DeploymentProvisioningEnvSet[];
}

export interface DeploymentProvisioningTargetRequest {
  action?: "create" | "register_existing";
  slot: EnvTargetSlot;
  provider: EnvProvider;
  ownershipMode: EnvOwnershipMode;
  providerConnectionId?: string;
  projectName?: string;
  providerProjectId?: string;
  providerProjectName?: string;
  branchName?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  renderDeployMethod?: RenderDeployMethod;
  renderServiceType?: RenderServiceType;
  renderRuntime?: RenderRuntime;
  renderInstanceType?: string;
  renderRegion?: string;
  renderEnvironmentName?: EnvEnvironment;
  dockerContext?: string;
  dockerfilePath?: string;
  imageUrl?: string;
  env?: DeploymentProvisioningEnvSet[];
}

export interface DeploymentProvisioningRequest {
  enabled: boolean;
  variableGroups?: DeploymentProvisioningVariableGroup[];
  sharedEnv?: DeploymentProvisioningEnvSet[];
  targets: DeploymentProvisioningTargetRequest[];
}

export interface DeploymentProvisioningResult {
  status: "skipped" | "completed" | "partial" | "failed";
  targets: Array<{
    slot: EnvTargetSlot;
    provider: EnvProvider;
    ownershipMode?: EnvOwnershipMode;
    deploymentStrategy?: DeploymentStrategy | null;
    status: "created" | "registered" | "failed";
    deploymentTargetId: string | null;
    providerProjectId: string | null;
    providerProjectName: string | null;
    providerMetadata?: Record<string, unknown>;
    renderServiceType?: RenderServiceType | null;
    renderRuntime?: RenderRuntime | null;
    renderInstanceType?: string | null;
    renderRegion?: string | null;
    renderEnvironmentName?: EnvEnvironment | null;
    dockerContext?: string | null;
    dockerfilePath?: string | null;
    imageUrl?: string | null;
    /** Branch this target tracks. Names the branch for a preview-lane write. */
    branchName?: string | null;
    errorSummary: string | null;
    env: Array<{
      lane: EnvLane;
      gitBranch: string | null;
      provisioned: Array<{ key: string; status: "provisioned" }>;
      failed: Array<{ key: string; status: "failed"; errorSummary: string }>;
    }>;
  }>;
}

export interface CategorySummary {
  name: string;
  count: number;
}

export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  iconName: string;
  categories: string[];
  filePatterns: string[];
  stack: "nextjs" | "react" | "react-native" | "expo" | "nestjs" | "nodejs";
  propertiesPath: string;
  workflowPath: string;
}

export interface CatalogTemplatesResponse {
  templates: CatalogTemplate[];
}

export interface CatalogCategoriesResponse {
  categories: CategorySummary[];
}

export type ProjectOptionKey =
  "lint" | "unit" | "build" | "coverage" | "security" | "docker" | "e2e";

export type MvpProjectOptionKey = Exclude<ProjectOptionKey, "e2e">;

export type ProjectOptionSet = Partial<Record<ProjectOptionKey, boolean>>;

export interface RepoShapeOption {
  id: string;
  label: string;
  enabled: boolean;
  description?: string;
}

export interface ProjectTypeOption {
  id: string;
  label: string;
  kind?: "frontend" | "backend";
  runtime?: string;
  language: string;
  framework: string;
  starterPath?: string;
  repoShapes: string[];
  reservedRepoShapes?: string[];
  defaultRecipe: string;
  allowedRecipes: string[];
  defaultOptions: ProjectOptionSet;
}

export interface WorkflowRecipeOption {
  id: string;
  label: string;
  description?: string;
  supportedProjectTypes: string[];
  templateByProjectType: Record<string, string>;
  workflowRefByProjectType?: Record<string, string>;
  mandatoryJobs?: string[];
  supportedOptions: ProjectOptionSet;
  optionJobs: Partial<Record<ProjectOptionKey, string>>;
}

export interface SubscriptionCheckoutResponse {
  checkoutId?: string;
  id?: string;
  status: string;
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionCheckoutStatusResponse {
  status: string;
  subscription?: SubscriptionInfo;
}

export type UsageLimitCode =
  | "projects"
  | "managed_render_services"
  | "managed_vercel_projects"
  | "deployment_targets"
  | "env_keys"
  | "workflow_prs";

export interface UsageLimitItem {
  code: UsageLimitCode;
  current: number;
  limit: number;
  upgradeRequired: boolean;
}

export interface UsageMeResponse {
  enabled: boolean;
  plan: "free" | "pro";
  items: UsageLimitItem[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  /**
   * A workspace IS a team — personal workspaces were removed, and the database
   * CHECK now permits nothing else. Kept as a single-member union because the
   * column is still selected and returned.
   */
  kind: "team";
  role: WorkspaceRole;
}

/**
 * Role rename plan §2.1 (confirmed 2026-07-14): 'admin' is now the TOP membership
 * tier (product label "Lead" — see GROUP_ROLE_LABELS in hierarchy-contracts.ts).
 * This is a different system from `identity.platform_admins` (platform-admin
 * tier) — same literal string, unrelated table/column. Do not conflate them.
 */
export type WorkspaceRole = "admin" | "delegated_lead" | "member" | "viewer";

export interface WorkspacesMeResponse {
  enabled: boolean;
  items: WorkspaceSummary[];
}

export interface WorkspaceMemberSummary {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  login: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AddWorkspaceMemberRequest {
  loginOrEmail: string;
  role: WorkspaceRole;
}

export interface UpdateWorkspaceMemberRoleRequest {
  role: WorkspaceRole;
}

export interface ProjectAuditEvent {
  id: string;
  eventCode: string;
  message: string;
  actorUserId: string | null;
  createdAt: string;
}

export interface ProjectAuditEventsResponse {
  enabled: boolean;
  items: ProjectAuditEvent[];
}

export interface NodeVersionOption {
  value: string;
  label: string;
}

export interface ProjectOptionsResponse {
  repoShapes: RepoShapeOption[];
  projectTypes: ProjectTypeOption[];
  recipes: WorkflowRecipeOption[];
  nodeVersions: NodeVersionOption[];
  /**
   * Login of the GitHub org every repository must belong to. Used to filter
   * the Setup-flow "existing repo" picker and to label already-attached
   * repos outside this org as "External" — never hardcode this value.
   */
  enforcedOrg: string;
}

export interface CentralWorkflowTagsResponse {
  tags: string[];
  defaultRef: string;
}

export interface GenerateWorkflowRequest {
  templateId: string;
  serviceName: string;
  servicePath?: string;
  nodeVersion?: string;
  coverageThreshold?: number;
  enhancements?: Array<
    | "strictProductionApproval"
    | "enableUatApproval"
    | "disablePlaywright"
    | "disableK6"
  >;
}

export interface SetupProjectRequest extends GenerateWorkflowRequest {
  repoFullName: string;
  outputFileName?: string;
  deploymentProvisioning?: DeploymentProvisioningRequest;
  /** Group/workspace to create this project inside (from ?group=<id>). */
  workspaceId?: string;
}

export interface GenerateWorkflowResponse {
  yaml: string;
  workflowFiles?: WorkflowFile[];
  metadata: {
    templateId: string;
    templateName: string;
    stack: string;
    generatedAt: string;
    sha256: string;
    byteSize: number;
    lineCount: number;
    substitutionsApplied: string[];
    enhancementsApplied: string[];
    sourcePropertiesFile: string;
    sourceWorkflowFile: string;
    outputFileName: string;
    workflowFiles?: WorkflowFileMetadata[];
  };
}

// "guard" is the standalone env-guard workflow seeded alongside the staged
// access/quality/package chain; it never reports run stages (see StageId).
export type WorkflowStage = "access" | "quality" | "package" | "guard";

export interface WorkflowFileMetadata {
  stage: WorkflowStage;
  name: string;
  path: string;
  gated: boolean;
}

export interface WorkflowFile extends WorkflowFileMetadata {
  yaml: string;
}

export interface WorkflowHistoryItem {
  id: string;
  createdAt: string;
  templateId: string;
  templateName: string;
  stack: string;
  serviceName: string;
  outputFileName: string;
  sourceWorkflowFile: string;
  sourcePropertiesFile: string;
  lineCount: number;
  yaml: string;
}

export interface WorkflowHistoryResponse {
  items: WorkflowHistoryItem[];
}

export interface GithubAppInstallUrlResponse {
  installUrl: string;
  appSlug?: string;
}

export interface LinkGithubInstallationResponse {
  reposLinked: number;
  repositorySelection?: "all" | "selected";
}

export interface LinkedGitHubRepo {
  installationId: number;
  repoFullName: string;
}

export interface LinkedGitHubReposResponse {
  repos: LinkedGitHubRepo[];
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
}

export interface GitHubReposResponse {
  repos: GitHubRepo[];
}

export interface GithubInstallationAccount {
  installationId: number;
  accountLogin: string | null;
  accountId: number | null;
  accountType?: "Organization" | "User" | null;
  repositorySelection: "all" | "selected";
}

export interface GithubInstallationAccountsResponse {
  accounts: GithubInstallationAccount[];
}

export interface SetupProjectResponse {
  id: string;
  repoFullName: string;
  status: "provisioned";
  workflowPath: string;
  workflowFiles?: WorkflowFileMetadata[];
  githubCommitSha: string;
  githubCommitUrl: string | null;
  deploymentProvisioning?: DeploymentProvisioningResult;
}

export interface MicroserviceSlotConfig {
  projectTypeId: string;
  workflowRecipeId?: string;
  serviceName: string;
  servicePath: string;
}

export interface MicroservicesConfig {
  backend: MicroserviceSlotConfig;
  frontend: MicroserviceSlotConfig;
}

export interface CreateProjectRequest {
  repoName: string;
  visibility: "private" | "public";
  ownerType?: "personal" | "organization";
  installationId?: number;
  repoShape?: string;
  projectTypeId: string;
  workflowRecipeId?: string;
  serviceName: string;
  servicePath?: string;
  nodeVersion?: string;
  coverageThreshold?: number;
  tests?: Partial<Record<MvpProjectOptionKey, boolean>>;
  outputFileName?: string;
  microservicesConfig?: MicroservicesConfig;
  multiRepoConfig?: MicroservicesConfig;
  deploymentProvisioning?: DeploymentProvisioningRequest;
  /** Group/workspace to create this project inside (from ?group=<id>). */
  workspaceId?: string;
}

export interface CreateProjectResponse {
  id: string;
  repoFullName: string;
  repoUrl: string;
  status: "provisioned";
  workflowPath: string;
  workflowFiles?: WorkflowFileMetadata[];
  githubCommitSha: string;
  githubCommitUrl: string | null;
  projectTypeId: string;
  workflowRecipeId: string;
  /**
   * Branches provisioning created. Optional because an older backend does not
   * send it; the caller falls back rather than inventing a list, which is how
   * the success screen came to name a branch that was never created.
   */
  branchesCreated?: string[];
  additionalWorkflowPaths?: string[];
  secondaryRepoFullName?: string;
  secondaryRepoUrl?: string;
  deploymentProvisioning?: DeploymentProvisioningResult;
}

export interface ProvisionedProject {
  id: string;
  repoFullName: string;
  templateId: string;
  serviceName: string;
  workflowPath: string;
  workflowFiles?: WorkflowFileMetadata[] | null;
  status: "provisioning" | "provisioned" | "failed" | "orphaned";
  githubCommitSha: string | null;
  githubCommitUrl: string | null;
  failureReason: string | null;
  repoUrl?: string | null;
  visibility?: string | null;
  repoShape?: string | null;
  projectTypeId?: string | null;
  workflowRecipeId?: string | null;
  projectOptions?: Record<string, unknown> | null;
  /**
   * Owning workspace id. For hierarchy-managed repositories this is the GROUP
   * id — the Projects screen uses it to bucket projects under their group.
   */
  workspaceId?: string | null;
  /**
   * Viewer-relative: true only when the authenticated user is the actual
   * project creator, not just able to see it via admin/manager visibility.
   * Only populated by endpoints that compute it against the current viewer
   * (currently `GET /api/v1/projects`) — undefined elsewhere.
   */
  isOwner?: boolean;
}

export type ProjectOverviewHealthStatus = "ok" | "warning" | "error";

export interface ProjectDashboardSnapshotFinding {
  code: string;
  severity: ProjectOverviewHealthStatus;
  message?: string;
  source?: "local_snapshot";
}

export interface ProjectDashboardSnapshot {
  id: string;
  projectId: string;
  status: ProjectOverviewHealthStatus;
  summary: Record<string, unknown>;
  findings: ProjectDashboardSnapshotFinding[];
  startedAt: string;
  completedAt: string;
  createdBy: string | null;
  createdAt: string;
}

export interface ProjectOverviewResponse {
  project: ProvisionedProject & {
    createdAt: string;
    updatedAt: string;
  };
  workflow: {
    path: string;
    files: WorkflowFileMetadata[];
    stageCount: number;
    history: WorkflowHistoryItem[];
  };
  deploymentTargets: {
    items: DeploymentTarget[];
    count: number;
  };
  environment: {
    items: EnvVarMetadata[];
    count: number;
    failedCount: number;
  };
  ciAuth: {
    status: "active" | "revoked" | "missing";
    tokenPresent: boolean;
    tokenPrefix: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    revokedAt: string | null;
  };
  health: {
    summary: ProjectOverviewHealthStatus;
    checks: Array<{
      key: string;
      label: string;
      status: ProjectOverviewHealthStatus;
      message: string;
    }>;
  };
  syncSnapshot: {
    enabled: boolean;
    mode: "local_snapshot";
    latest: ProjectDashboardSnapshot | null;
  };
  capabilities: {
    envProvisioning: boolean;
    workflowSettings: boolean;
    syncSnapshots: boolean;
    ciRunTracking: boolean;
    deploymentHistory: boolean;
    driftDetection: boolean;
  };
  /**
   * hierarchy.repositories id for this project, or null.
   *
   * Developer assignments are keyed on hierarchy.repositories rather than on
   * the provisioned project, so this is the only way the project page can
   * address its own access panel. Null means there is no assignment surface
   * (personal-workspace project, or one predating the link) and the Access
   * entry point is hidden rather than pointed at a URL that would 404.
   *
   * Optional so a project page served by an older backend degrades to hiding
   * the entry point instead of failing to parse the response.
   */
  hierarchyRepositoryId?: string | null;
}

export type ProjectCiRunStage =
  | "access_gate"
  | "quality"
  | "package"
  | "deploy_render"
  | "deploy_vercel"
  | "unknown";

export interface ProjectCiRun {
  id: string;
  stage: ProjectCiRunStage;
  workflowName: string;
  branch: string;
  commitSha: string | null;
  actor: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  canRerun: boolean;
}

export interface ProjectCiRunsResponse {
  enabled: boolean;
  mode: "local_mock";
  liveGithubEnabled: boolean;
  githubActionsUrl: string;
  runs: ProjectCiRun[];
}

export interface ProjectCiRunRerunResponse {
  enabled: false;
  runId: string;
  reason: string;
}

export type DeploymentHistoryStatus =
  "queued" | "building" | "ready" | "failed" | "canceled" | "unknown";

export interface ProjectDeploymentHistoryItem {
  id: string;
  targetId: string;
  targetName: string;
  provider: EnvProvider;
  /** Provider lane ('production' / 'preview') or the Render environment name. */
  environment: string | null;
  branch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  status: DeploymentHistoryStatus;
  createdAt: string;
  readyAt: string | null;
  /** The deployed site itself — per-deployment on Vercel, per-service on Render. */
  deploymentUrl: string | null;
  /** Set when the deployment was built for a pull request. */
  pullRequestNumber: number | null;
  /** Provider console for this single deployment, when the provider has one. */
  inspectorUrl: string | null;
  /** Provider console for the project as a whole. */
  dashboardUrl: string;
  /** Provider console's deployment list for the project. */
  consoleUrl: string;
}

export interface ProjectDeploymentsResponse {
  enabled: boolean;
  /**
   * `unavailable` means the provider was asked and did not answer — distinct
   * from `local_mock`, which means there was nothing to ask.
   */
  mode: "local_mock" | "live" | "unavailable";
  liveProvidersEnabled: boolean;
  deployments: ProjectDeploymentHistoryItem[];
  /** Safe message naming the providers that could not be reached. */
  providerError: string | null;
}

/**
 * One branch's current deployment. The unit is the branch, not the deployment:
 * a push updates that branch's card rather than appending a row.
 */
export interface ProjectBranchPreview {
  branch: string;
  isProduction: boolean;
  deploymentId: string;
  targetId: string;
  targetName: string;
  provider: EnvProvider;
  status: DeploymentHistoryStatus;
  commitSha: string | null;
  commitMessage: string | null;
  pullRequestNumber: number | null;
  previewUrl: string | null;
  inspectorUrl: string | null;
  createdAt: string;
  readyAt: string | null;
  /**
   * null means undetermined. The UI must not frame it in that case — a browser
   * fires no error event for an X-Frame-Options refusal, so an unverified
   * embed shows an unexplained blank box.
   */
  embeddable: boolean | null;
  embedBlockedReason: string | null;
}

export interface ProjectPreviewsResponse {
  enabled: boolean;
  liveProvidersEnabled: boolean;
  branches: ProjectBranchPreview[];
  /** Set when a provider could not be reached, so an empty list is not read as "nothing deployed". */
  providerError: string | null;
}

export type ProjectDriftSeverity = "info" | "warning" | "error";
export type ProjectDriftStatus = "active" | "resolved" | "ignored";

export interface ProjectDriftFinding {
  id: string;
  projectId: string;
  targetId: string | null;
  source: "local_snapshot";
  severity: ProjectDriftSeverity;
  code: string;
  message: string;
  details: Record<string, unknown>;
  status: ProjectDriftStatus;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface ProjectDriftResponse {
  enabled: boolean;
  mode: "local_snapshot";
  findings: ProjectDriftFinding[];
}

export type ProjectDriftRepairAction =
  | "regenerate_workflow_preview"
  | "create_workflow_update_pr"
  | "rotate_ci_token"
  | "detach_target"
  | "mark_ignored";

export interface ProjectDriftRepairResponse {
  enabled: boolean;
  mode: "local_safe";
  findingId: string;
  action: ProjectDriftRepairAction;
  status: "completed" | "disabled";
  message: string;
  result?: Record<string, unknown>;
}

export interface ProjectSyncSnapshotResponse {
  snapshot: ProjectDashboardSnapshot;
  overview: ProjectOverviewResponse;
}

export interface WorkflowSettings {
  projectId: string;
  templateId: string;
  projectTypeId: string | null;
  workflowRecipeId: string | null;
  serviceName: string;
  servicePath: string;
  nodeVersion: string;
  packageManager: "npm";
  coverageThreshold: number;
  centralWorkflowRef: string;
  checks: {
    lint: boolean;
    unit: boolean;
    build: boolean;
    security: boolean;
  };
}

export interface WorkflowSettingsResponse {
  enabled: boolean;
  source: "stored" | "project_options";
  settings: WorkflowSettings;
}

export interface WorkflowSettingsPreviewRequest {
  templateId?: string;
  projectTypeId?: string | null;
  workflowRecipeId?: string | null;
  serviceName?: string;
  servicePath?: string;
  nodeVersion?: string;
  packageManager?: "npm";
  coverageThreshold?: number;
  centralWorkflowRef?: string;
  checks?: Partial<WorkflowSettings["checks"]>;
}

export interface WorkflowSettingsPreviewResponse {
  settings: WorkflowSettings;
  workflowFiles: Array<WorkflowFileMetadata & { yaml: string }>;
  diffSummary: Array<{
    path: string;
    status: "new" | "changed" | "unchanged";
  }>;
  validationWarnings: Array<{
    field: string;
    message: string;
  }>;
}

export interface WorkflowUpdatePullRequestResponse {
  projectId: string;
  repoFullName: string;
  branchName: string;
  workflowPath: string;
  workflowFiles: WorkflowFileMetadata[];
  pullRequestNumber: number;
  pullRequestUrl: string;
  status: "created";
}

export interface ProvisionedProjectsResponse {
  items: ProvisionedProject[];
}

export interface DiscoverExistingRepoRequest {
  repoFullName: string;
  baseBranch?: string;
}

export type ExistingRepoWarningCode =
  | "branch_protected"
  | "sonar_already_configured"
  | "uat_missing"
  | "project_type_undetected";

export interface ExistingRepoWarning {
  code: ExistingRepoWarningCode;
  message: string;
}

export interface DiscoverExistingRepoResponse {
  repoFullName: string;
  /** The repository's own default branch, read from GitHub — not assumed. */
  baseBranch: string;
  detectedProjectTypeId: string | null;
  recommendedWorkflowRecipeId: string;
  serviceName: string;
  servicePath: string;
  /**
   * What setup is about to do, and what it cannot do — reported before
   * anything is written. Optional so a page served by an older backend simply
   * shows no notices instead of failing to parse.
   */
  warnings?: ExistingRepoWarning[];
}

export interface SetupExistingRepoPrRequest {
  repoFullName: string;
  baseBranch?: string;
  projectTypeId: string;
  workflowRecipeId?: string;
  serviceName: string;
  servicePath?: string;
  nodeVersion?: string;
  coverageThreshold?: number;
  outputFileName?: string;
}

export interface SetupExistingRepoPrResponse {
  repoFullName: string;
  branchName: string;
  workflowPath: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
}

export interface CreateGithubRepoRequest {
  repoName: string;
  description?: string;
  private: boolean;
}

export interface CreateGithubRepoResponse {
  repoUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  branchesCreated: string[];
}

export interface PendingAccountResponse {
  pending: boolean;
  login?: string;
  archivedAt?: string;
  purgeAt?: string;
  retentionDays?: number;
}

/* ── CI Runs ─────────────────────────────────────────────────────────────── */

export type RunOverallStatus =
  "success" | "failure" | "running" | "cancelled" | "partial";
/**
 * Mirrors STAGE_ORDER in the backend's pipelines/ci/application/stages.ts, and
 * the CHECK constraint on workflow.ci_run_reports.stage. All three widen
 * together or a stage the pipeline reports is one this client cannot render.
 *
 * `verify` is the only one that needs a running service: the first three read
 * source, and none of them can say whether what was deployed actually works.
 */
export type StageId = "access" | "quality" | "package" | "verify";
/**
 * A stage's state.
 *
 * `pending` used to cover every stage that had not reported, which hid the case
 * that mattered: a workflow rejected before any job ran cannot report, so a
 * broken pipeline looked merely slow. Two states separate that out.
 *
 *   blocked  an earlier stage did not pass, so this one was never triggered
 *   stalled  the stage before it succeeded and nothing ever arrived — the
 *            workflow did not start, and never will
 */
export type StageStatus =
  | "success"
  | "failure"
  | "running"
  | "cancelled"
  | "pending"
  | "blocked"
  | "stalled";
export type MessageSeverity = "info" | "warning" | "error" | "success";

export interface FriendlyMessage {
  severity: MessageSeverity;
  title: string;
  detail: string;
  hint: string;
  /**
   * Optional list of concrete failure details already humanized by the backend.
   * Each item is one discrete failure: a failing test, a lint rule violation,
   * or a vulnerable dependency. Rendered as a friendly visual list inside the
   * message card — never as raw log output.
   *
   * `label`  — the primary identifier (test name, rule name, package name)
   * `sub`    — optional secondary context (failure reason, file:line, severity)
   */
  items?: { label: string; sub?: string }[];
}

export interface StageReport {
  stage: StageId;
  status: StageStatus;
  /** The GitHub run this stage executed in, for fetching its failure output. */
  runId: number;
  friendlyMessages: FriendlyMessage[];
  githubRunUrl: string;
  updatedAt: string;
  /** Raw CI log output for this stage. Present only when the backend includes it. */
  rawLogs?: string;
  /**
   * What each tool inside the stage concluded.
   *
   * A stage status answers "did quality pass"; it cannot answer "did the
   * licence scan pass". On dev the gates are advisory, so a stage is routinely
   * green with a failing tool inside it — which is exactly the case the single
   * status bar could not show.
   *
   * Absent for a stage reported by a pipeline generated before per-tool
   * reporting. Absent means "not known", never "no tools ran".
   */
  checks?: StageCheck[];
}

/** One tool's outcome inside a stage. */
export interface StageCheck {
  name: string;
  conclusion: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RunGroup {
  runId: number;
  repoFullName: string;
  branch: string;
  commitSha: string;
  startedAt: string;
  overallStatus: RunOverallStatus;
  stages: StageReport[];
}

export interface RunsResponse {
  runs: RunGroup[];
}

/**
 * UI state type for the result of POST /api/v1/projects (unified endpoint).
 * Derived from CreateProjectResponse plus helpers computed on the client side.
 */
export interface CreateProjectResult {
  /** Database ID of the provisioned project record. */
  id: string;
  repoFullName: string;
  repoUrl: string;
  status: "provisioned";
  /** Full path of the committed workflow file, e.g. `.github/workflows/ci.yml`. */
  workflowPath: string;
  workflowFiles?: WorkflowFileMetadata[];
  /** Basename of the workflow file, derived from workflowPath. */
  outputFileName: string;
  githubCommitSha: string;
  githubCommitUrl: string | null;
  projectTypeId: string;
  workflowRecipeId: string;
  /** Branch names always created by the unified endpoint: main, uat, develop. */
  branchesCreated: string[];
  /** Additional workflow file paths committed for microservices shapes. */
  additionalWorkflowPaths?: string[];
  secondaryRepoFullName?: string;
  secondaryRepoUrl?: string;
  deploymentProvisioning?: DeploymentProvisioningResult;
}
