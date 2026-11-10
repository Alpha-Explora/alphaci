/* Inbox categories: every event code the backend sends, grouped the way
 * people look for it. Pure: no React, no I/O. An unknown code is "Other", so a
 * newer backend's events still show under All. */

import type { NotificationItem } from '../../model/notifications-types';

export type NotificationCategory =
  'qa' | 'code' | 'delivery' | 'team' | 'other';
export type NotificationCategoryFilter = NotificationCategory | 'all';

export const NOTIFICATION_CATEGORY_ORDER: ReadonlyArray<NotificationCategory> =
  ['qa', 'code', 'delivery', 'team', 'other'];

const LABELS: Readonly<Record<NotificationCategory, string>> = {
  qa: 'QA & defects',
  code: 'Pull requests & merges',
  delivery: 'Pipelines & deploys',
  team: 'Team & to-dos',
  other: 'Other',
};

export function notificationCategoryLabel(
  category: NotificationCategory,
): string {
  return LABELS[category];
}

/** First match wins: merges before QA (qa.promotion.*), deliveries before QA (qa.iteration.*). */
const RULES: ReadonlyArray<[RegExp, NotificationCategory]> = [
  [
    /^qa\.promotion\.|pull_request|^github\.|branch_created|^repository/,
    'code',
  ],
  [
    /^qa\.iteration\.|^deployment_|^env_var|^drift_|^ci_token|^workflow_|^quota_|^project_sync|^project_snapshot/,
    'delivery',
  ],
  [/^qa\.|^visual_baselines/, 'qa'],
  [
    /^team\.|^user\.|^hierarchy\.|^project\.todo\.|^project_created|^project_deleted|^project_github_repo|membership/,
    'team',
  ],
];

export function notificationCategory(eventCode: string): NotificationCategory {
  return RULES.find(([pattern]) => pattern.test(eventCode))?.[1] ?? 'other';
}

export interface CategoryCount {
  category: NotificationCategory;
  label: string;
  count: number;
}

/** The categories present in `items`, in display order, with how many each holds. */
export function notificationCategoryCounts(
  items: ReadonlyArray<Pick<NotificationItem, 'eventCode'>>,
): CategoryCount[] {
  const counts = new Map<NotificationCategory, number>();
  for (const item of items) {
    const category = notificationCategory(item.eventCode);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return NOTIFICATION_CATEGORY_ORDER.flatMap((category) => {
    const count = counts.get(category) ?? 0;
    return count > 0 ? [{ category, label: LABELS[category], count }] : [];
  });
}

export function filterByCategory<T extends Pick<NotificationItem, 'eventCode'>>(
  items: ReadonlyArray<T>,
  category: NotificationCategoryFilter,
): T[] {
  return category === 'all'
    ? [...items]
    : items.filter((item) => notificationCategory(item.eventCode) === category);
}
