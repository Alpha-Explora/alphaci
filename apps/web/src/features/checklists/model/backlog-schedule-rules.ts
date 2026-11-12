/* A story's place on the backlog's calendar: its due date, priority and how
 * close the date is. Pure: no React, no fetch. Dates are "YYYY-MM-DD" days in
 * the viewer's calendar, never instants. */

import { errorStatus, oneOf, text, type Loose } from './wire-readers';
import { qaCodeMessage } from './qa-error-messages';
import type {
  BacklogPriority,
  RequirementItem,
  RequirementProgress,
} from './requirement-types';

export const BACKLOG_PRIORITIES: ReadonlyArray<BacklogPriority> = [
  'urgent',
  'high',
  'medium',
  'low',
];

const PRIORITY_LABELS: Readonly<Record<BacklogPriority, string>> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function priorityLabel(priority: BacklogPriority): string {
  return PRIORITY_LABELS[priority];
}

/** The schedule fields, only when the server sent them: an older backend's stories read as before. */
export function scheduleFrom(
  raw: Loose,
): Pick<RequirementItem, 'dueDate' | 'priority'> {
  if (!('dueDate' in raw) && !('priority' in raw)) return {};
  const dueDate = text(raw.dueDate);
  return {
    dueDate: dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
    priority: oneOf(raw.priority, BACKLOG_PRIORITIES),
  };
}

/** True once the server reads and writes schedules (it sent the fields). */
export function canSchedule(item: Pick<RequirementItem, 'dueDate'>): boolean {
  return item.dueDate !== undefined;
}

/** Today in the viewer's calendar, as "YYYY-MM-DD". */
export function todayDateOnly(now: Date = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dayNumber(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export type DueState = 'overdue' | 'due_today' | 'due_soon' | 'scheduled';

/** Within three days counts as soon. A Done story is never overdue. Null without a date. */
export function dueState(
  item: { dueDate?: string | null; progress: RequirementProgress },
  today: string,
): DueState | null {
  if (!item.dueDate || item.progress === 'done') return null;
  const days = dayNumber(item.dueDate) - dayNumber(today);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due_today';
  return days <= 3 ? 'due_soon' : 'scheduled';
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** "Overdue by 2 days", "Due today", "Due tomorrow", "Due 14 Nov" (with the year when it is not this year). */
export function dueLabel(
  dueDate: string,
  today: string,
  locale?: string,
): string {
  const days = dayNumber(dueDate) - dayNumber(today);
  if (days < 0) return `Overdue by ${plural(-days, 'day')}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  const [year, month, day] = dueDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const label = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: dueDate.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  }).format(date);
  return `Due ${label}`;
}

export interface ScheduleDraft {
  /** "" for none. */
  dueDate: string;
  /** "" for none. */
  priority: BacklogPriority | '';
}

export function scheduleDraftOf(
  item: Pick<RequirementItem, 'dueDate' | 'priority'>,
): ScheduleDraft {
  return { dueDate: item.dueDate ?? '', priority: item.priority ?? '' };
}

export interface SetScheduleInput {
  dueDate?: string | null;
  priority?: BacklogPriority | null;
}

/** Only what changed; null when nothing did (Save then just closes). */
export function scheduleInput(
  draft: ScheduleDraft,
  item: Pick<RequirementItem, 'dueDate' | 'priority'>,
): SetScheduleInput | null {
  const dueDate = draft.dueDate || null;
  const priority = draft.priority || null;
  const input: SetScheduleInput = {
    ...(dueDate !== (item.dueDate ?? null) ? { dueDate } : {}),
    ...(priority !== (item.priority ?? null) ? { priority } : {}),
  };
  return Object.keys(input).length > 0 ? input : null;
}

/** A refused schedule, in product words. */
export function scheduleErrorMessage(cause: unknown): string {
  const byCode = qaCodeMessage(cause);
  if (byCode) return byCode;
  if (errorStatus(cause) === 403)
    return 'Only a Product owner or admin can schedule stories.';
  if (errorStatus(cause) === 404)
    return 'This story could not be found, or this server cannot schedule stories yet.';
  return 'The schedule could not be saved. Try again in a moment.';
}
