import { isForeignKeyViolation } from './postgres-errors';

describe('isForeignKeyViolation', () => {
  const violation = (constraint: string) => ({ code: '23503', constraint });

  it('is true for a foreign key violation on the named constraint', () => {
    expect(
      isForeignKeyViolation(
        violation('audit_events_project_id_fkey'),
        'audit_events_project_id_fkey',
      ),
    ).toBe(true);
  });

  it('is false for a violation on another constraint of the same table', () => {
    expect(
      isForeignKeyViolation(
        violation('audit_events_workspace_id_fkey'),
        'audit_events_project_id_fkey',
      ),
    ).toBe(false);
  });

  it('is false for another error code on that constraint name', () => {
    expect(
      isForeignKeyViolation(
        { code: '23505', constraint: 'audit_events_project_id_fkey' },
        'audit_events_project_id_fkey',
      ),
    ).toBe(false);
  });

  it.each([null, undefined, 'boom', 42, new Error('no code')])(
    'is false for %p',
    (error) => {
      expect(isForeignKeyViolation(error, 'audit_events_project_id_fkey')).toBe(
        false,
      );
    },
  );
});
