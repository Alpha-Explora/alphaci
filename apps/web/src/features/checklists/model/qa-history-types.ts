import type { QaHistoryEvent } from '@/shared/api/contracts';

/* The wire types, declared in @alphaci/api-contracts. */
export type { QaHistoryEvent, QaHistoryPage } from '@/shared/api/contracts';

export function historyEventLabel(event: QaHistoryEvent): string {
  if (event.type === 'progress_changed')
    return `Development: ${label(event.fromStatus)} → ${label(event.toStatus)}`;
  if (event.type === 'fix_requested') return 'Fix ready for QA retest';
  if (event.type === 'signed_off')
    return `QA sign-off: ${label(event.toStatus)}`;
  if (event.payload.poStatus === 'passed') return 'Accepted by Product Owner';
  if (event.payload.testCase) return 'Test case result recorded';
  if (event.payload.import) return 'Test definitions imported; review required';
  if (event.type === 'status_changed')
    return `QA: ${label(event.fromStatus)} → ${label(event.toStatus)}`;
  return 'QA details updated';
}
function label(value: string | null): string {
  return value?.replaceAll('_', ' ') ?? 'unknown';
}

export function historyEventDetails(event: QaHistoryEvent): string[] {
  const fields = {
    notes: 'Notes',
    note: 'Fix note',
    defectSeverity: 'Severity',
    reproductionSteps: 'Reproduction steps',
    summary: 'Summary',
  };
  const details = Object.entries(fields).flatMap(([key, fieldLabel]) =>
    typeof event.payload[key] === 'string' && event.payload[key]
      ? [`${fieldLabel}: ${event.payload[key] as string}`]
      : [],
  );
  const test = event.payload.testCase;
  if (test && typeof test === 'object') {
    const row = test as Record<string, unknown>;
    if (typeof row.title === 'string') details.push(row.title);
    if (typeof row.to === 'string') details.push(`Result: ${row.to}`);
    if (typeof row.notes === 'string' && row.notes) details.push(row.notes);
  }
  if (event.payload.supersededAt) details.push('This sign-off was superseded.');
  return details;
}
