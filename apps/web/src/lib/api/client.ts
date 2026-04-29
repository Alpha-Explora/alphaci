import type {
  AuthMeResponse,
  CatalogCategoriesResponse,
  CatalogTemplatesResponse,
  GenerateWorkflowRequest,
  GenerateWorkflowResponse,
  GithubAppInstallUrlResponse,
  GitHubReposResponse,
  LinkedGitHubReposResponse,
  LinkGithubInstallationResponse,
  ProvisionedProjectsResponse,
  SetupProjectRequest,
  SetupProjectResponse,
  SubscriptionInfo,
  WorkflowHistoryResponse,
} from "./contracts";

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1",
);

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new ApiError(`Request failed with status ${response.status}`, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function createGitHubLoginUrl(returnTo: string): string {
  return `${API_BASE_URL}/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export function createGoogleLoginUrl(returnTo: string): string {
  return `${API_BASE_URL}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function getAuthSession(): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/auth/me");
}

export async function logout(): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export async function getCategories(): Promise<CatalogCategoriesResponse> {
  return request<CatalogCategoriesResponse>("/catalog/categories");
}

export async function getTemplates(params: {
  category?: string;
  stack?: string;
  q?: string;
}): Promise<CatalogTemplatesResponse> {
  const search = new URLSearchParams();
  if (params.category) {
    search.set("category", params.category);
  }
  if (params.stack) {
    search.set("stack", params.stack);
  }
  if (params.q) {
    search.set("q", params.q);
  }

  const suffix = search.size ? `?${search.toString()}` : "";
  return request<CatalogTemplatesResponse>(`/catalog/templates${suffix}`);
}

export async function activateMonthlySubscription(plan: "pro" | "enterprise"): Promise<SubscriptionInfo> {
  const response = await request<{ subscription: SubscriptionInfo }>("/subscription/monthly/activate", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });

  return response.subscription;
}

export async function cancelMonthlySubscription(): Promise<SubscriptionInfo> {
  const response = await request<{ subscription: SubscriptionInfo }>("/subscription/monthly/cancel", {
    method: "POST",
  });

  return response.subscription;
}

export async function generateWorkflow(
  payload: GenerateWorkflowRequest,
): Promise<GenerateWorkflowResponse> {
  return request<GenerateWorkflowResponse>("/workflows/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setupProject(payload: SetupProjectRequest): Promise<SetupProjectResponse> {
  return request<SetupProjectResponse>("/projects/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProjects(limit = 25): Promise<ProvisionedProjectsResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return request<ProvisionedProjectsResponse>(`/projects?limit=${safeLimit}`);
}

export async function getWorkflowHistory(limit = 25): Promise<WorkflowHistoryResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return request<WorkflowHistoryResponse>(`/workflows/history?limit=${safeLimit}`);
}

export async function getGithubRepos(): Promise<GitHubReposResponse> {
  return request<GitHubReposResponse>("/github/repos");
}

export async function getGithubAppInstallUrl(): Promise<GithubAppInstallUrlResponse> {
  return request<GithubAppInstallUrlResponse>("/github/app/install-url");
}

export async function linkGithubInstallation(
  installationId: number,
): Promise<LinkGithubInstallationResponse> {
  return request<LinkGithubInstallationResponse>("/github/installations", {
    method: "POST",
    body: JSON.stringify({ installationId }),
  });
}

export async function getLinkedGithubRepos(): Promise<LinkedGitHubReposResponse> {
  return request<LinkedGitHubReposResponse>("/github/installations/repos");
}
