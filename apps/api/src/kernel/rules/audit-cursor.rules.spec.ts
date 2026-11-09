import {
  AUDIT_CURSOR_PATTERN,
  formatAuditCursor,
  parseAuditCursor,
} from './audit-cursor.rules';

const AT = '2026-06-15T00:00:00.123456Z';
const ID = '0a1b2c3d-0000-4000-8000-000000000002';

describe('audit cursor', () => {
  it('round-trips a timestamp and an event id', () => {
    expect(parseAuditCursor(formatAuditCursor(AT, ID))).toEqual({
      createdAt: AT,
      eventId: ID,
    });
  });

  it('still reads a bare timestamp, with no event id', () => {
    expect(parseAuditCursor(AT)).toEqual({ createdAt: AT, eventId: null });
    expect(parseAuditCursor('2026-06-15T08:00:00+08:00')).toEqual({
      createdAt: '2026-06-15T08:00:00+08:00',
      eventId: null,
    });
  });

  it.each([
    '',
    'yesterday',
    '2026-13-45T99:00:00Z',
    `${AT}|`,
    `${AT}|not-a-uuid`,
    `${AT}|${ID}|${ID}`,
    `|${ID}`,
    `${AT} ${ID}`,
  ])('rejects %p', (value) => {
    expect(parseAuditCursor(value)).toBeNull();
  });

  it('is the one pattern the controller and the repository share', () => {
    expect(AUDIT_CURSOR_PATTERN.test(formatAuditCursor(AT, ID))).toBe(true);
    expect(AUDIT_CURSOR_PATTERN.test(AT)).toBe(true);
  });
});
