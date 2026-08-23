import {
  getAdminFeedback,
  getAdminUser,
  getAdminUsers,
  resetUserAppRoleToGithub,
  setUserAppRole,
  triageAdminFeedback,
} from "@/lib/api/admin";

import type {
  AdminUserDetail,
  AdminUsersPage,
  AppRole,
  FeedbackRecord,
  FeedbackStatus,
} from "../model/admin-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do. */

/** The page size the user list has always requested. */
const USERS_LIMIT = 50;

export const adminRepository = {
  users(search: string): Promise<AdminUsersPage> {
    return getAdminUsers({ search: search || undefined, limit: USERS_LIMIT });
  },

  user(id: string): Promise<AdminUserDetail> {
    return getAdminUser(id);
  },

  setUserRole(id: string, role: AppRole): Promise<void> {
    return setUserAppRole(id, role);
  },

  /** Unpins the user so GitHub team membership drives their role again. */
  resetUserRoleToGithub(id: string): Promise<void> {
    return resetUserAppRoleToGithub(id);
  },

  feedback(status: FeedbackStatus | "all"): Promise<FeedbackRecord[]> {
    return getAdminFeedback(status === "all" ? undefined : status);
  },

  triageFeedback(id: string, status: FeedbackStatus): Promise<FeedbackRecord> {
    return triageAdminFeedback(id, { status });
  },
};
