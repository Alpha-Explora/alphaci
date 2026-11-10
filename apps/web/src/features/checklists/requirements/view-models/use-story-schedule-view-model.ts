'use client';

import { useState } from 'react';

import { requirementsRepository } from '../../data/requirements-repository';
import {
  scheduleDraftOf,
  scheduleErrorMessage,
  scheduleInput,
  type ScheduleDraft,
} from '../../model/backlog-schedule-rules';
import type { RequirementItem } from '../../model/requirement-types';

export interface StoryScheduleViewModel {
  open: boolean;
  draft: ScheduleDraft;
  saving: boolean;
  error: string | null;
  openEditor: () => void;
  close: () => void;
  setDraft: (patch: Partial<ScheduleDraft>) => void;
  save: () => Promise<void>;
}

/**
 * The inline due date and priority editor of one story. Saves only what
 * changed, then lets the list read again; a refusal keeps the editor open
 * with the reason. The server re-checks who may schedule.
 */
export function useStoryScheduleViewModel(
  item: RequirementItem,
  onSaved: () => void,
): StoryScheduleViewModel {
  const [open, setOpen] = useState(false);
  const [draft, setDraftState] = useState<ScheduleDraft>(() =>
    scheduleDraftOf(item),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    const input = scheduleInput(draft, item);
    if (!input) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await requirementsRepository.setSchedule(item, input);
      setOpen(false);
      onSaved();
    } catch (cause) {
      setError(scheduleErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return {
    open,
    draft,
    saving,
    error,
    openEditor: () => {
      setDraftState(scheduleDraftOf(item));
      setError(null);
      setOpen(true);
    },
    close: () => {
      if (!saving) setOpen(false);
    },
    setDraft: (patch) => setDraftState((current) => ({ ...current, ...patch })),
    save,
  };
}
