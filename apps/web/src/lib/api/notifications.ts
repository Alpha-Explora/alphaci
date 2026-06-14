import type { NotificationsResponse } from "./contracts";
import { request } from "./request";

export async function getNotifications(): Promise<NotificationsResponse> {
  return request<NotificationsResponse>("/notifications");
}

export async function markNotificationRead(id: string): Promise<{ id: string; read: true }> {
  return request<{ id: string; read: true }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}
