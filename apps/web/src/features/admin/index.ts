/* Domain barrel — shared types and pure rules only. Actions come from their own
 * slice (`@/features/admin/users`, `@/features/admin/feedback`, …). */
export type {
  AdminStatus,
  AdminUserDetail,
  AdminUsersPage,
  AppRole,
  FeedbackRecord,
  FeedbackStatus,
} from "./model/admin-types";

export {
  FEEDBACK_STATUS_FILTERS,
  NEXT_FEEDBACK_STATUS,
  ROLE_ORDER,
  describeRoleError,
} from "./model/admin-rules";
