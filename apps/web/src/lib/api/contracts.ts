export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type SubscriptionStatus = "inactive" | "active" | "canceled";

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
  provider: "mock" | "supabase" | "manual";
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
}

export interface GenerateWorkflowResponse {
  yaml: string;
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
  };
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

export interface GithubAppInstallUrlResponse {
  installUrl: string;
}

export interface LinkGithubInstallationResponse {
  reposLinked: number;
}

export interface LinkedGitHubRepo {
  installationId: number;
  repoFullName: string;
  private?: boolean;
}

export interface LinkedGitHubReposResponse {
  repos: LinkedGitHubRepo[];
}

export interface SetupProjectResponse {
  id: string;
  repoFullName: string;
  status: "provisioned";
  workflowPath: string;
  githubCommitSha: string;
  githubCommitUrl: string | null;
}

export interface ProvisionedProject {
  id: string;
  repoFullName: string;
  templateId: string;
  serviceName: string;
  workflowPath: string;
  status: "provisioning" | "provisioned" | "failed";
  githubCommitSha: string | null;
  githubCommitUrl: string | null;
  failureReason: string | null;
}

export interface ProvisionedProjectsResponse {
  items: ProvisionedProject[];
}
