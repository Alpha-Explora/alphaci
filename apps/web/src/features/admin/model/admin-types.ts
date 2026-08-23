/* Domain types for the admin console. Re-exported through this file so the
 * slice has one type surface and views never reach into lib/api. */
export type {
  AdminUserDetail,
  AdminUsersPage,
  AppRole,
  FeedbackRecord,
  FeedbackStatus,
} from "@/lib/api/admin";
export { APP_ROLE_LABELS } from "@/lib/api/admin";

/** Lifecycle of one independently-loaded admin section. */
export type AdminStatus = "loading" | "ready" | "error";
