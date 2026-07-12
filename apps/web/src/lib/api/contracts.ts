export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active" | "canceled";
export type EnvProvider = "render" | "vercel";
export type EnvEnvironment = "test" | "uat" | "production";
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

export interface AuthMeResponse {
  authenticated: boolean;
  user: SessionUser;
  subscription: SubscriptionInfo;
  /** null for ordinary users; set for platform admins. Gates the /admin surface. */
  platformRole?: PlatformRole | null;
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
}

export interface DisconnectProjectResponse {
  ok: boolean;
  githubRepoDeleted?: boolean;
  githubRepoDeleteError?: {
    code: "missing_scope" | "not_found" | "other";
    message: string;
  };
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
  environment: EnvEnvironment;
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
  environment: EnvEnvironment;
  vars: Array<{ key: string; value: string }>;
}

export interface ProvisionEnvVarsResponse {
  provisioned: Array<{ key: string; status: "provisioned" }>;
  failed: Array<{ key: string; status: "failed"; errorSummary: string }>;
}

export interface ValidateEnvVarsRequest {
  deploymentTargetId: string;
  environment: EnvEnvironment;
  text: string;
}

export interface ValidateEnvVarsResponse {
  keyCount: number;
  keys: string[];
  duplicates: string[];
  invalidKeys: string[];
  warnings: Array<{ code: string; message: string }>;
}

export interface DeleteEnvVarMetadataResponse {
  removed: true;
  key: string;
}

export interface DeploymentProvisioningEnvSet {
  environment: EnvEnvironment;
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
    errorSummary: string | null;
    env: Array<{
      environment: EnvEnvironment;
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
  kind: "personal" | "team";
  role: WorkspaceRole;
}

export type WorkspaceRole = "owner" | "admin" | "developer" | "viewer";

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

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  eventCode: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  enabled: boolean;
  items: NotificationItem[];
  unreadCount: number;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string;
}

export interface UpdateNotificationPreferencesRequest {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
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
  environment: string | null;
  branch: string | null;
  commitSha: string | null;
  status: DeploymentHistoryStatus;
  createdAt: string;
  readyAt: string | null;
  providerUrl: string;
  consoleUrl: string;
}

export interface ProjectDeploymentsResponse {
  enabled: boolean;
  mode: "local_mock" | "live";
  liveProvidersEnabled: boolean;
  deployments: ProjectDeploymentHistoryItem[];
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

export interface DiscoverExistingRepoResponse {
  repoFullName: string;
  baseBranch: string;
  detectedProjectTypeId: string | null;
  recommendedWorkflowRecipeId: string;
  serviceName: string;
  servicePath: string;
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
export type StageId = "access" | "quality" | "package";
export type StageStatus =
  "success" | "failure" | "running" | "cancelled" | "pending";
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
  friendlyMessages: FriendlyMessage[];
  githubRunUrl: string;
  updatedAt: string;
  /** Raw CI log output for this stage. Present only when the backend includes it. */
  rawLogs?: string;
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
