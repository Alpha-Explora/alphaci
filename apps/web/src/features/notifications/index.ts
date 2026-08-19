/**
 * Notifications — public API.
 *
 * The entire surface of this feature. `api/`, `model/` and `ui/` are private:
 * `.dependency-cruiser.cjs` fails the build if anything outside this directory
 * reaches past this file.
 *
 * Deliberately NOT exported:
 *   getNotifications / markNotificationRead — the transport layer. A consumer
 *     that calls these directly is re-implementing the ViewModel. Use the hooks.
 *   grouping.ts — an internal detail of how the inbox renders a list.
 */

// Views — mounted by routes and by other features' pages.
export { InboxPage } from "./ui/inbox-page";
export { NotificationPreferencesSection } from "./ui/notification-preferences-section";

// Presentation helpers — the nav renders a notification summary of its own.
export {
  formatNotificationTime,
  notificationLabel,
  NotificationGlyph,
} from "./ui/notification-utils";

// ViewModels — for a consumer composing its own view over this data.
export { useInbox } from "./model/use-inbox";
export { useNotificationPrefs } from "./model/use-notification-prefs";
export type { InboxViewModel, InboxFilter } from "./model/use-inbox";
export type { NotificationPrefsViewModel } from "./model/use-notification-prefs";

// Contracts — the shapes crossing this boundary.
export type {
  NotificationItem,
  NotificationsResponse,
  NotificationPreferences,
  UpdateNotificationPreferencesRequest,
} from "./api/notifications.contracts";
