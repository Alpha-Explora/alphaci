/* Domain types shared by every notifications action (inbox, preferences).
 *
 * Domain-level model/ is the sanctioned share point when more than one action
 * needs the same types — see the skill's domain-sharing guidance. Pure types
 * only: no React, no Next, no I/O. */

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  eventCode: string;
  readAt: string | null;
  createdAt: string;
  /**
   * Deep-link targets (spec §8.6). Declared non-optional per the backend
   * contract, but every reader treats an absent field the same as an
   * explicit null — an older backend simply omits them.
   */
  projectId: string | null;
  groupId: string | null;
  deliveryProjectId: string | null;
}

export interface NotificationsResponse {
  enabled: boolean;
  items: NotificationItem[];
  unreadCount: number;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string;
}

export interface UpdateNotificationPreferencesRequest {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}

/** Every interactive view-model in this domain reports one of these. */
export type NotificationsStatus = "idle" | "loading" | "ready" | "error";
