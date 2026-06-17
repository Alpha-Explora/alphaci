import type { PlatformRole } from "./contracts";
import { request } from "./request";

/* ── Types (mirror the BE admin view models) ─────────────────────────────── */

export interface AdminUserListItem {
  id: string;
  login: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  provider: string;
  createdAt: string;
  lastLoginAt: string | null;
  archivedAt: string | null;
  onboardingCompleted: boolean;
  projectCount: number;
  errorCount: number;
}

export interface AdminUsersPage {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserProject {
  id: string;
  repo_full_name: string;
  service_name: string | null;
  status: string;
  is_example: boolean;
  created_at: string;
}

export interface AdminUserWorkflow {
  id: string;
  template_name: string;
  stack: string;
  service_name: string;
  created_at: string;
}

export interface AdminUserError {
  id: string;
  repo_full_name: string;
  branch: string;
  run_id: string;
  stage: string;
  status: string;
  friendly_messages: unknown;
  created_at: string;
}

export interface AdminUserActivity {
  id: string;
  event_code: string;
  message: string;
  created_at: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  subscription: {
    plan: string;
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  projects: AdminUserProject[];
  workflows: AdminUserWorkflow[];
  recentErrors: AdminUserError[];
  recentActivity: AdminUserActivity[];
}

export interface PlatformAdminRecord {
  userId: string;
  login: string;
  displayName: string | null;
  role: PlatformRole;
  grantedBy: string | null;
  grantedAt: string;
}

export type FeedbackStatus = "open" | "in_review" | "resolved" | "dismissed";
export type FeedbackCategory =
  | "general"
  | "bug"
  | "feature_request"
  | "billing"
  | "other";

export interface FeedbackRecord {
  id: string;
  userId: string;
  userLogin: string | null;
  category: FeedbackCategory;
  subject: string;
  body: string;
  status: FeedbackStatus;
  adminResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Calls ───────────────────────────────────────────────────────────────── */

export async function getAdminUsers(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminUsersPage> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<AdminUsersPage>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  return request<AdminUserDetail>(`/admin/users/${id}`);
}

export async function getAdminUserErrors(
  id: string,
): Promise<{ items: AdminUserError[] }> {
  return request<{ items: AdminUserError[] }>(`/admin/users/${id}/errors`);
}

export async function getPlatformAdmins(): Promise<PlatformAdminRecord[]> {
  return request<PlatformAdminRecord[]>(`/admin/admins`);
}

export async function grantPlatformRole(
  id: string,
  role: PlatformRole,
): Promise<void> {
  await request(`/admin/users/${id}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export async function revokePlatformRole(id: string): Promise<void> {
  await request(`/admin/users/${id}/role`, { method: "DELETE" });
}

export async function getAdminFeedback(
  status?: FeedbackStatus,
): Promise<FeedbackRecord[]> {
  const qs = status ? `?status=${status}` : "";
  return request<FeedbackRecord[]>(`/admin/feedback${qs}`);
}

export async function triageAdminFeedback(
  id: string,
  body: { status?: FeedbackStatus; adminResponse?: string },
): Promise<FeedbackRecord> {
  return request<FeedbackRecord>(`/admin/feedback/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getAdminAccessLog(): Promise<{
  items: AdminUserActivity[];
}> {
  return request<{ items: AdminUserActivity[] }>(`/admin/access-log`);
}
