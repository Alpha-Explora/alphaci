import type {
  AuthMeResponse,
  CatalogCategoriesResponse,
  CatalogTemplatesResponse,
  GenerateWorkflowRequest,
  GenerateWorkflowResponse,
  SubscriptionInfo,
} from "./contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";

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

export async function activateMockSubscription(plan: "pro" | "enterprise"): Promise<SubscriptionInfo> {
  const response = await request<{ subscription: SubscriptionInfo }>("/subscription/mock/activate", {
    method: "POST",
    body: JSON.stringify({ plan }),
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
