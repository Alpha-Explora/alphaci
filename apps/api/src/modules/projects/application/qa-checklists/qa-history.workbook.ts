import { Workbook } from 'exceljs';

import type { QaHistoryEvent } from '../../infrastructure/qa-history.repository';

/** The most events one export carries; older ones are summarised in a note row. */
export const QA_HISTORY_EXPORT_MAX_EVENTS = 5000;

const EVENT_LABELS: Record<string, string> = {
  progress_changed: 'Developer progress',
  status_changed: 'QA verification',
  edited: 'QA defect details edited',
  fix_requested: 'Developer fix submitted',
  signed_off: 'QA sign-off',
};

/** What the payload adds, in one readable line (defect notes, severity, fix note, summary). */
export function describePayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of [
    'severity',
    'notes',
    'reproductionSteps',
    'note',
    'summary',
    'reason',
  ]) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${key}: ${value.trim()}`);
    }
  }
  return parts.join(' | ');
}

/**
 * The Dev and QA audit trail as an .xlsx file, newest first: who changed
 * what, from which state to which, and why. Values are written as plain text,
 * so nothing in a note is ever evaluated as a formula.
 */
export async function renderQaHistoryWorkbook(input: {
  projectName: string;
  generatedAt: Date;
  events: readonly QaHistoryEvent[];
  truncated: boolean;
}): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'ALPHACI';
  workbook.created = input.generatedAt;
  const sheet = workbook.addWorksheet('Audit trail', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: 'When (UTC)', width: 22 },
    { header: 'Iteration', width: 10 },
    { header: 'Feature', width: 28 },
    { header: 'Story / item', width: 40 },
    { header: 'Who', width: 18 },
    { header: 'Event', width: 24 },
    { header: 'From', width: 16 },
    { header: 'To', width: 16 },
    { header: 'Details', width: 60, style: { alignment: { wrapText: true } } },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const event of input.events) {
    sheet.addRow([
      event.createdAt.replace('T', ' ').slice(0, 19),
      event.iterationNumber ?? null,
      event.requirementName || null,
      event.title,
      event.actorLogin ? `@${event.actorLogin}` : null,
      EVENT_LABELS[event.type] ?? event.type,
      event.fromStatus,
      event.toStatus,
      describePayload(event.payload ?? {}) || null,
    ]);
  }
  if (input.truncated) {
    sheet.addRow([
      `Only the newest ${String(QA_HISTORY_EXPORT_MAX_EVENTS)} events are included. Filter by iteration to export older ones.`,
    ]);
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
