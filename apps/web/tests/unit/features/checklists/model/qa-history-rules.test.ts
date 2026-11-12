import {
  historyEventDetails,
  historyEventLabel,
  type QaHistoryEvent,
} from '../../../../../src/features/checklists/model/qa-history-types';
const event = (overrides: Partial<QaHistoryEvent> = {}): QaHistoryEvent => ({
  id: 'event',
  createdAt: '2026-10-27T00:00:00Z',
  iterationId: 'it',
  runId: 'run',
  itemId: 'story',
  title: 'Login',
  requirementName: 'Account',
  actorLogin: 'qa',
  type: 'status_changed',
  fromStatus: 'pending',
  toStatus: 'failed',
  payload: {},
  ...overrides,
});
it('distinguishes development, QA failures, fix requests, sign-offs and PO acceptance', () => {
  expect(historyEventLabel(event())).toBe('QA: pending → failed');
  expect(
    historyEventLabel(
      event({
        type: 'progress_changed',
        fromStatus: 'done',
        toStatus: 'in_progress',
      }),
    ),
  ).toBe('Development: done → in progress');
  expect(historyEventLabel(event({ type: 'fix_requested' }))).toContain(
    'retest',
  );
  expect(
    historyEventLabel(event({ type: 'signed_off', toStatus: 'REJECTED' })),
  ).toContain('REJECTED');
  expect(
    historyEventLabel(event({ payload: { poStatus: 'passed' } })),
  ).toContain('Product Owner');
});
it('preserves earlier defect notes, fix notes and per-case results', () => {
  expect(
    historyEventDetails(
      event({
        payload: {
          notes: 'Broken',
          note: 'Fixed',
          reproductionSteps: 'Open account',
          testCase: { title: 'Login', to: 'failed', notes: 'Profile missing' },
        },
      }),
    ),
  ).toEqual([
    'Notes: Broken',
    'Fix note: Fixed',
    'Reproduction steps: Open account',
    'Login',
    'Result: failed',
    'Profile missing',
  ]);
});
