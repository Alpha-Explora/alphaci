import type {
  NotificationPreferences,
  NotificationsResponse,
  UpdateNotificationPreferencesRequest,
} from "./notifications.contracts";
import { request } from "@/lib/api/request";

export async function getNotifications(): Promise<NotificationsResponse> {
  return request<NotificationsResponse>("/notifications");
}

export async function markNotificationRead(id: string): Promise<{ id: string; read: true }> {
  return request<{ id: string; read: true }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/notifications/preferences");
}

export async function updateNotificationPreferences(
  payload: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
