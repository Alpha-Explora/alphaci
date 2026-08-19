/* Domain barrel — shared types only.
 *
 * Actions are imported from their own slice (`@/features/notifications/inbox`,
 * `@/features/notifications/preferences`) so a consumer pulls in one action
 * rather than the whole domain. */
export type {
  NotificationItem,
  NotificationsResponse,
  NotificationPreferences,
  UpdateNotificationPreferencesRequest,
  NotificationsStatus,
} from "./model/notifications-types";
