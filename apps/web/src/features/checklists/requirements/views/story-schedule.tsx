'use client';

import { useId } from 'react';

import {
  BACKLOG_PRIORITIES,
  canSchedule,
  dueLabel,
  dueState,
  priorityLabel,
  todayDateOnly,
} from '../../model/backlog-schedule-rules';
import type {
  BacklogPriority,
  RequirementItem,
} from '../../model/requirement-types';
import {
  useStoryScheduleViewModel,
  type StoryScheduleViewModel,
} from '../view-models/use-story-schedule-view-model';

/** "Urgent" and "Overdue by 2 days" beside a story; nothing without a schedule. */
function ScheduleChips({ item }: Readonly<{ item: RequirementItem }>) {
  const today = todayDateOnly();
  const state = dueState(item, today);
  return (
    <>
      {item.priority ? (
        <span className="rq-schedule__chip" data-priority={item.priority}>
          {priorityLabel(item.priority)}
        </span>
      ) : null}
      {item.dueDate ? (
        <span className="rq-schedule__chip" data-due={state ?? 'done'}>
          {state ? dueLabel(item.dueDate, today) : `Was due ${item.dueDate}`}
        </span>
      ) : null}
    </>
  );
}

function ScheduleEditor({
  vm,
  title,
}: Readonly<{ vm: StoryScheduleViewModel; title: string }>) {
  const errorId = useId();
  return (
    <form
      className="rq-schedule__editor"
      aria-label={`Schedule ${title}`}
      onSubmit={(event) => {
        event.preventDefault();
        void vm.save();
      }}
    >
      <label className="hier-field">
        <span className="hier-field-label">Due date</span>
        <input
          className="hier-input"
          type="date"
          value={vm.draft.dueDate}
          disabled={vm.saving}
          aria-describedby={vm.error ? errorId : undefined}
          onChange={(event) => vm.setDraft({ dueDate: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Priority</span>
        <select
          className="hier-select"
          value={vm.draft.priority}
          disabled={vm.saving}
          onChange={(event) =>
            vm.setDraft({
              priority: event.target.value as BacklogPriority | '',
            })
          }
        >
          <option value="">None</option>
          {BACKLOG_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabel(priority)}
            </option>
          ))}
        </select>
      </label>
      <span className="rq-schedule__actions">
        <button type="submit" className="primary-button" disabled={vm.saving}>
          {vm.saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={vm.saving}
          onClick={vm.close}
        >
          Cancel
        </button>
      </span>
      {vm.error ? (
        <p className="rq-form-error" id={errorId} role="alert">
          {vm.error}
        </p>
      ) : null}
    </form>
  );
}

/** Reschedule (or Set due date) while closed, the editor while open. */
function ScheduleAction({
  vm,
  item,
}: Readonly<{ vm: StoryScheduleViewModel; item: RequirementItem }>) {
  if (vm.open) return <ScheduleEditor vm={vm} title={item.title} />;
  return (
    <button type="button" className="rq-link" onClick={vm.openEditor}>
      {item.dueDate || item.priority ? 'Reschedule' : 'Set due date'}
    </button>
  );
}

/**
 * A story's due date and priority: chips for everyone, and Schedule for a
 * Product owner or admin once the server supports it.
 */
export function StorySchedule({
  item,
  canManage,
  onSaved,
}: Readonly<{
  item: RequirementItem;
  canManage: boolean;
  onSaved: () => void;
}>) {
  const vm = useStoryScheduleViewModel(item, onSaved);
  const editable = canManage && canSchedule(item);
  if (!editable && !item.dueDate && !item.priority) return null;
  return (
    <div className="rq-schedule">
      <ScheduleChips item={item} />
      {editable ? <ScheduleAction vm={vm} item={item} /> : null}
    </div>
  );
}
