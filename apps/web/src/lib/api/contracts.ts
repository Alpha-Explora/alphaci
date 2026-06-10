export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active" | "canceled";
export type EnvProvider = "render" | "vercel";
export type EnvEnvironment = "test" | "uat" | "production";
export type EnvOwnershipMode = "byo" | "flowci_managed";
export type EnvTargetSlot = "backend" | "frontend" | "standalone";
export type DeploymentStrategy = "provider_native" | "vercel_git_connected" | "vercel_ci_pushed";

export interface SessionUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
  email?: string;
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

export interface AuthMeResponse {
  authenticated: boolean;
  user: SessionUser;
  subscription: SubscriptionInfo;
}

export interface CapabilitiesResponse {
  envProvisioning: {
    enabled: boolean;
    providers: EnvProvider[];
    environments: EnvEnvironment[];
    modes: EnvOwnershipMode[];
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
  environmentMap: Record<string, unknown>;
  deploymentStrategy?: DeploymentStrategy;
  providerMetadata?: Record<string, unknown>;
  status: "active" | "missing" | "failed";
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
  environmentMap?: Record<string, unknown>;
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

export interface DeploymentProvisioningEnvSet {
  environment: EnvEnvironment;
  vars: Array<{ key: string; value: string }>;
}

export interface DeploymentProvisioningTargetRequest {
  slot: EnvTargetSlot;
  provider: EnvProvider;
  ownershipMode: EnvOwnershipMode;
  providerConnectionId?: string;
  projectName?: string;
  branchName?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  env?: DeploymentProvisioningEnvSet[];
}

export interface DeploymentProvisioningRequest {
  enabled: boolean;
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
  | "lint"
  | "unit"
  | "build"
  | "coverage"
  | "security"
  | "docker"
  | "e2e";

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

export interface ProjectOptionsResponse {
  repoShapes: RepoShapeOption[];
  projectTypes: ProjectTypeOption[];
  recipes: WorkflowRecipeOption[];
}

export interface GenerateWorkflowRequest {
  templateId: string;
  serviceName: string;
  servicePath?: string;
  nodeVersion?: string;
  coverageThreshold?: number;
  enhancements?: Array<
    "strictProductionApproval" | "enableUatApproval" | "disablePlaywright" | "disableK6"
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

export type WorkflowStage = "access" | "quality" | "package";

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
  /** Branch names always created by the unified endpoint: main, uat, test. */
  branchesCreated: string[];
  /** Additional workflow file paths committed for microservices shapes. */
  additionalWorkflowPaths?: string[];
  secondaryRepoFullName?: string;
  secondaryRepoUrl?: string;
  deploymentProvisioning?: DeploymentProvisioningResult;
}
