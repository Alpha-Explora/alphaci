import {
  filterByCategory,
  notificationCategory,
  notificationCategoryCounts,
} from '@/features/notifications/inbox/model/notification-category-rules';
import { notificationHref } from '@/features/notifications/model/notification-links';

/* Phase 4, item 12: the Inbox filters by kind of event, and the newer QA
 * release events open the viewer's studio. */

describe('inbox categories', () => {
  it.each([
    ['qa.item.failed', 'qa'],
    ['qa.run.rejected', 'qa'],
    ['visual_baselines_approved', 'qa'],
    ['qa.promotion.merged', 'code'],
    ['qa.promotion.override_merged', 'code'],
    ['pull_request_created', 'code'],
    ['github.pull_request.reviewed', 'code'],
    ['repository_branch_created', 'code'],
    ['qa.iteration.delivered', 'delivery'],
    ['deployment_target_failed', 'delivery'],
    ['workflow_pr_created', 'delivery'],
    ['hierarchy.group.member_added', 'team'],
    ['team.membership.changed', 'team'],
    ['project.todo.assigned', 'team'],
    ['project_created', 'team'],
    ['something.new', 'other'],
  ])('files %s under %s', (eventCode, category) => {
    expect(notificationCategory(eventCode)).toBe(category);
  });

  it('counts only the kinds present, in a fixed order', () => {
    const items = [
      { eventCode: 'project_created' },
      { eventCode: 'qa.item.failed' },
      { eventCode: 'qa.run.rejected' },
    ];
    expect(notificationCategoryCounts(items)).toEqual([
      { category: 'qa', label: 'QA & defects', count: 2 },
      { category: 'team', label: 'Team & to-dos', count: 1 },
    ]);
    expect(notificationCategoryCounts([])).toEqual([]);
  });

  it('narrows a list to one kind, or keeps all', () => {
    const items = [
      { eventCode: 'project_created' },
      { eventCode: 'qa.item.failed' },
    ];
    expect(filterByCategory(items, 'qa')).toEqual([
      { eventCode: 'qa.item.failed' },
    ]);
    expect(filterByCategory(items, 'all')).toHaveLength(2);
  });

  it.each([
    'qa.promotion.override_merged',
    'qa.iteration.delivered',
    'qa.iteration.started',
  ])("opens the viewer's studio for %s", (eventCode) => {
    const href = notificationHref(
      { eventCode, projectId: 'p-1', groupId: null, deliveryProjectId: null },
      'qa',
    );
    expect(href).toMatch(/^\/projects\/p-1#/);
  });
});
