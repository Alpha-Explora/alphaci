import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { requirementsRepository } from '@/features/checklists/data/requirements-repository';
import {
  dueLabel,
  dueState,
  scheduleFrom,
  scheduleInput,
  todayDateOnly,
} from '@/features/checklists/model/backlog-schedule-rules';
import { normalizeRequirementItem } from '@/features/checklists/model/requirement-rules';
import type { RequirementItem } from '@/features/checklists/model/requirement-types';
import { StorySchedule } from '@/features/checklists/requirements/views/story-schedule';

/* Phase 4, item 10: stories in the backlog carry a due date and priority. */

const TODAY = '2026-10-28';

function story(overrides: Partial<RequirementItem> = {}): RequirementItem {
  return {
    id: 'item-1',
    requirementId: 'req-1',
    position: 0,
    title: 'Pay by card',
    acceptanceCriteria: null,
    verificationType: 'manual',
    testIdentifier: null,
    progress: 'todo',
    progressBy: null,
    progressAt: null,
    rowVersion: 1,
    canSetProgress: true,
    testCategories: [],
    dueDate: null,
    priority: null,
    ...overrides,
  };
}

describe('backlog schedule rules', () => {
  it('reads the schedule only when the server sends it', () => {
    expect(scheduleFrom({ dueDate: '2026-11-14', priority: 'high' })).toEqual({
      dueDate: '2026-11-14',
      priority: 'high',
    });
    expect(scheduleFrom({ dueDate: '14/11/2026', priority: 'soon' })).toEqual({
      dueDate: null,
      priority: null,
    });
    expect(scheduleFrom({})).toEqual({});
    const older = normalizeRequirementItem({ id: 'i', title: 't' }, 'r');
    expect(older).not.toHaveProperty('dueDate');
  });

  it('says how close a date is, and never calls a Done story overdue', () => {
    expect(dueState({ dueDate: '2026-10-27', progress: 'todo' }, TODAY)).toBe(
      'overdue',
    );
    expect(dueState({ dueDate: TODAY, progress: 'in_progress' }, TODAY)).toBe(
      'due_today',
    );
    expect(dueState({ dueDate: '2026-10-31', progress: 'todo' }, TODAY)).toBe(
      'due_soon',
    );
    expect(dueState({ dueDate: '2026-11-30', progress: 'todo' }, TODAY)).toBe(
      'scheduled',
    );
    expect(
      dueState({ dueDate: '2026-10-01', progress: 'done' }, TODAY),
    ).toBeNull();
    expect(dueState({ dueDate: null, progress: 'todo' }, TODAY)).toBeNull();
  });

  it('labels the date in words', () => {
    expect(dueLabel('2026-10-26', TODAY)).toBe('Overdue by 2 days');
    expect(dueLabel('2026-10-27', TODAY)).toBe('Overdue by 1 day');
    expect(dueLabel(TODAY, TODAY)).toBe('Due today');
    expect(dueLabel('2026-10-29', TODAY)).toBe('Due tomorrow');
    expect(dueLabel('2026-11-14', TODAY, 'en-GB')).toBe('Due 14 Nov');
    expect(dueLabel('2027-01-05', TODAY, 'en-GB')).toBe('Due 5 Jan 2027');
  });

  it('counts days across a month end and a leap day', () => {
    expect(
      dueState({ dueDate: '2028-03-01', progress: 'todo' }, '2028-02-28'),
    ).toBe('due_soon');
    expect(dueLabel('2028-02-29', '2028-02-28')).toBe('Due tomorrow');
  });

  it('sends only what changed', () => {
    const item = story({ dueDate: '2026-11-14', priority: 'high' });
    expect(
      scheduleInput({ dueDate: '2026-11-14', priority: 'high' }, item),
    ).toBeNull();
    expect(scheduleInput({ dueDate: '', priority: 'high' }, item)).toEqual({
      dueDate: null,
    });
    expect(
      scheduleInput({ dueDate: '2026-11-15', priority: '' }, item),
    ).toEqual({ dueDate: '2026-11-15', priority: null });
  });

  it("reads today in the viewer's calendar", () => {
    expect(todayDateOnly(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('StorySchedule', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onSaved = jest.fn();

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onSaved.mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    jest.restoreAllMocks();
  });

  function show(item: RequirementItem, canManage: boolean) {
    act(() =>
      root.render(
        <StorySchedule item={item} canManage={canManage} onSaved={onSaved} />,
      ),
    );
  }
  function button(name: string): HTMLButtonElement {
    const found = [...host.querySelectorAll('button')].find(
      (entry) => entry.textContent === name,
    );
    if (!found) throw new Error(`no button ${name}`);
    return found;
  }
  function setValue(selector: string, value: string) {
    const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(
      selector,
    );
    if (!field) throw new Error(`no field ${selector}`);
    const proto =
      field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    act(() => {
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(field, value);
      field.dispatchEvent(
        new Event(field instanceof HTMLSelectElement ? 'change' : 'input', {
          bubbles: true,
        }),
      );
    });
  }
  async function submit() {
    await act(async () => {
      button('Save').click();
      await Promise.resolve();
    });
  }

  it('shows nothing on a backend without schedules', () => {
    show(story({ dueDate: undefined, priority: undefined }), true);
    expect(host.innerHTML).toBe('');
  });

  it('shows the chips to everyone, without the editor for a Developer', () => {
    show(story({ priority: 'urgent', dueDate: '2000-01-01' }), false);
    expect(host.textContent).toContain('Urgent');
    expect(host.textContent).toMatch(/Overdue by/);
    expect(host.querySelector('button')).toBeNull();
  });

  it('lets a Product owner set a due date and priority, sending only those', async () => {
    const setSchedule = jest
      .spyOn(requirementsRepository, 'setSchedule')
      .mockResolvedValue(story());
    show(story(), true);

    act(() => button('Set due date').click());
    setValue('input[type="date"]', '2026-11-14');
    setValue('select', 'high');
    await submit();

    expect(onSaved).toHaveBeenCalled();
    expect(setSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
      {
        dueDate: '2026-11-14',
        priority: 'high',
      },
    );
  });

  it('keeps the editor open with the reason when the server refuses', async () => {
    jest
      .spyOn(requirementsRepository, 'setSchedule')
      .mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));
    show(story(), true);

    act(() => button('Set due date').click());
    setValue('select', 'low');
    await submit();

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      'Only a Product owner or admin can schedule stories.',
    );
    expect(host.querySelector('input[type="date"]')).not.toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
