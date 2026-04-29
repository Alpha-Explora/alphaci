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
    return "workflow-core/workflow-templates";
  }

  const normalized = path.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();

  for (const marker of ["/workflow-core/", "/cicd-workflow/"]) {
    const repoIndex = lower.lastIndexOf(marker);
    if (repoIndex >= 0) {
      const relative = normalized.slice(repoIndex + marker.length);
      return `workflow-core/${relative}`;
    }
  }

  const trimmed = normalized.replace(/^\/+/, "");
  if (trimmed.startsWith("workflow-core/")) {
    return trimmed;
  }

  if (trimmed.startsWith("cicd-workflow/")) {
    return `workflow-core/${trimmed.slice("cicd-workflow/".length)}`;
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return normalized;
  }

  return `workflow-core/${trimmed}`;
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

export function formatApiError(error: unknown, fallback: string): string {
  const details = (error as ApiError)?.details;

  if (!details) {
    return fallback;
  }

  if (typeof details === "string") {
    return `${fallback}: ${details}`;
  }

  if (typeof details === "object" && details !== null && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return `${fallback}: ${message.join(", ")}`;
    }

    if (typeof message === "string") {
      return `${fallback}: ${message}`;
    }
  }

  return `${fallback}: ${JSON.stringify(details)}`;
}
