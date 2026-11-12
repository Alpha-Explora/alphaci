import { isDateOnly, toDateOnly } from './backlog-schedule.rules';

describe('backlog schedule rules', () => {
  it('accepts real calendar dates only', () => {
    expect(isDateOnly('2026-11-14')).toBe(true);
    expect(isDateOnly('2028-02-29')).toBe(true);
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2026-13-01')).toBe(false);
    expect(isDateOnly('14/11/2026')).toBe(false);
    expect(isDateOnly('2026-11-14T00:00:00Z')).toBe(false);
  });

  it('reads a DATE column back as the stored day', () => {
    expect(toDateOnly(new Date(2026, 10, 14))).toBe('2026-11-14');
    expect(toDateOnly('2026-11-14')).toBe('2026-11-14');
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeNull();
  });
});
