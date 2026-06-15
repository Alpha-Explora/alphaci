import type { CatalogTemplate, CategorySummary, SetupProjectRequest } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/request";

export type WorkflowTab = "setup" | "current" | "all";

export const WORKFLOW_TABS: WorkflowTab[] = ["setup", "current", "all"];

export const enhancementLabels: Array<{
  key: NonNullable<SetupProjectRequest["enhancements"]>[number];
  label: string;
  description: string;
}> = [
  {
    key: "strictProductionApproval",
    label: "Strict production approval",
    description: "Require multi-step production approvals before release",
  },
  {
    key: "enableUatApproval",
    label: "Enable UAT approval",
    description: "Add dedicated QA/UAT gates before production",
  },
  {
    key: "disablePlaywright",
    label: "Disable Playwright",
    description: "Skip browser E2E checks in generated workflow",
  },
  {
    key: "disableK6",
    label: "Disable k6",
    description: "Disable synthetic load smoke tests",
  },
];

export function statusBannerVariant(message: string): "error" | "success" | "info" {
  const lower = message.toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) return "error";
  if (
    lower.includes("generat") ||
    lower.includes("copied") ||
    lower.includes("download") ||
    lower.includes("completed") ||
    lower.includes("linked")
  ) return "success";
  return "info";
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .trim()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-");
}

export function toSourcePath(path: string): string {
  if (!path) {
    return "cicd-workflow/workflow-templates";
  }

  const normalized = path.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();

  for (const marker of ["/workflow-core/", "/cicd-workflow/"]) {
    const repoIndex = lower.lastIndexOf(marker);
    if (repoIndex >= 0) {
      const relative = normalized.slice(repoIndex + marker.length);
      return `cicd-workflow/${relative}`;
    }
  }

  const trimmed = normalized.replace(/^\/+/, "");
  if (trimmed.startsWith("workflow-core/")) {
    return `cicd-workflow/${trimmed.slice("workflow-core/".length)}`;
  }

  if (trimmed.startsWith("cicd-workflow/")) {
    return trimmed;
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return normalized;
  }

  return `cicd-workflow/${trimmed}`;
}

export function chooseSelectedTemplate(
  templates: CatalogTemplate[],
  current: CatalogTemplate | null,
): CatalogTemplate | null {
  if (templates.length === 0) {
    return null;
  }

  if (current) {
    const exists = templates.some((template) => template.id === current.id);
    if (exists) {
      return current;
    }
  }

  return templates[0];
}

export function categoryFallbacks(templates: CatalogTemplate[]): CategorySummary[] {
  const counts = new Map<string, number>();

  for (const template of templates) {
    for (const category of template.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatQuotaStatus(input: {
  current: number;
  limit: number;
  upgradeRequired: boolean;
}): string {
  if (input.limit <= 0) return "Unavailable";
  const remaining = Math.max(0, input.limit - input.current);
  if (remaining === 0) {
    return input.upgradeRequired
      ? "Limit reached. Upgrade to continue."
      : "Limit reached.";
  }
  return `${remaining} remaining`;
}

export function formatApiError(error: unknown, fallback: string): string {
  if (isQuotaError(error)) {
    return "Quota reached. Upgrade your plan or remove unused resources.";
  }

  const details = (error as ApiError)?.details;

  if (!details) {
    return fallback;
  }

  if (typeof details === "string") {
    return `${fallback}: ${cleanUserMessage(details)}`;
  }

  if (typeof details === "object" && details !== null && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return `${fallback}: ${message.map(cleanUserMessage).join(", ")}`;
    }

    if (typeof message === "string") {
      return `${fallback}: ${cleanUserMessage(message)}`;
    }
  }

  return `${fallback}: ${cleanUserMessage(JSON.stringify(details))}`;
}

export function cleanUserMessage(value: unknown): string {
  const message = String(value);
  const knownMessage =
    parseDuplicateRepositoryMessage(message) ??
    parseRenderProvisioningMessage(message) ??
    parseProviderIntegrationMessage(message) ??
    parseGenericServerMessage(message);
  if (knownMessage) return knownMessage;

  return stripNoisyApiPayload(message);
}

function parseRenderProvisioningMessage(message: string): string | null {
  if (
    /Render billing is not configured|selected instance type requires payment/i.test(
      message,
    )
  ) {
    return "Render billing is not configured for this workspace or the selected plan requires payment.";
  }

  if (/A Render service with this name already exists/i.test(message)) {
    return "A Render service with this name already exists. Choose a different service name or attach the existing service.";
  }

  if (/Render API key is invalid|missing required workspace access/i.test(message)) {
    return "The Render API key cannot access the selected workspace.";
  }

  if (/Render provider metadata is missing|Render deployment secrets/i.test(message)) {
    return "Render service was created, but FlowCI could not install the deployment secrets.";
  }

  if (/image pull|registry|GHCR/i.test(message)) {
    return "Render could not pull the deployment image. Check registry access and retry.";
  }

  return null;
}

function parseDuplicateRepositoryMessage(message: string): string | null {
  if (
    message.includes("name already exists on this account") ||
    message.includes("Repository already exists or name is invalid")
  ) {
    return "A repository with this name already exists on this GitHub account. Choose another repository name and try again.";
  }

  return null;
}

function parseProviderIntegrationMessage(message: string): string | null {
  if (
    message.includes("install the GitHub integration") ||
    message.includes("Install GitHub App")
  ) {
    return "Vercel cannot access this GitHub repository yet. Install or update the Vercel GitHub integration for the repository owner, then retry.";
  }

  if (
    message.includes("invalid_root_directory") ||
    message.includes("Root Directory must be a relative path")
  ) {
    return "The root directory must be a relative path, for example \"frontend\". Do not use \"./\" or \"../\".";
  }

  if (message.includes("Missing team access")) {
    return "The configured Vercel token does not have access to the selected team or project.";
  }

  return null;
}

function parseGenericServerMessage(message: string): string | null {
  if (
    message.includes("quota_exceeded") ||
    message.includes("Request failed with status 402") ||
    message.includes("Request failed with status 403")
  ) {
    return "Quota reached. Upgrade your plan or remove unused resources.";
  }

  if (message === "Internal Server Error" || message.includes("Request failed with status 500")) {
    return "Something went wrong while processing the request. Please retry, then check the backend logs if it happens again.";
  }

  if (message.includes("Request failed with status 401")) {
    return "Your session has expired. Sign in again and retry.";
  }

  if (message.includes("Request failed with status 403")) {
    return "You do not have access to perform this action.";
  }

  return null;
}

function isQuotaError(error: unknown): boolean {
  const apiError = error as Partial<ApiError>;
  if (apiError.status === 402 || apiError.status === 403) {
    return true;
  }

  const details = apiError.details;
  if (typeof details === "string") {
    return details.includes("quota_exceeded");
  }

  if (typeof details === "object" && details !== null) {
    const code = (details as { code?: unknown }).code;
    if (code === "quota_exceeded") {
      return true;
    }

    const message = (details as { message?: unknown }).message;
    if (typeof message === "string" && message.includes("quota_exceeded")) {
      return true;
    }
  }

  return false;
}

function stripNoisyApiPayload(message: string): string {
  return message
    .replaceAll(/https:\/\/docs\.github\.com\/[^\s"'}]+/g, "GitHub API docs")
    .replaceAll(/"documentation_url":"[^"]+",?/g, "")
    .replaceAll(/"status":"?\d+"?,?/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}
