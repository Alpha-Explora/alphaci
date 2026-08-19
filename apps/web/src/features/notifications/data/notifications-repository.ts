import { request } from "@/lib/api/request";

import type {
  NotificationPreferences,
  NotificationsResponse,
  UpdateNotificationPreferencesRequest,
} from "../model/notifications-types";

/* The only place in this domain that performs I/O.
 *
 * Domain-level data/ because both the inbox and the preferences panel read
 * through it. View-models call these; views never do. */

export const notificationsRepository = {
  async list(): Promise<NotificationsResponse> {
    return request<NotificationsResponse>("/notifications");
  },

  async markRead(id: string): Promise<{ id: string; read: true }> {
    return request<{ id: string; read: true }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    );
  },

  async getPreferences(): Promise<NotificationPreferences> {
    return request<NotificationPreferences>("/notifications/preferences");
  },

  async updatePreferences(
    payload: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferences> {
    return request<NotificationPreferences>("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};
