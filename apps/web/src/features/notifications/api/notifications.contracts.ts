/* Notification contracts — the shapes crossing this feature's boundary.
 *
 * Moved out of lib/api/contracts.ts, which had grown to 1,247 lines holding
 * every feature's types in one file. A type belongs with the feature that
 * owns it, so this file changes only when notifications change.
 */

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  eventCode: string;
  readAt: string | null;
  createdAt: string;
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
