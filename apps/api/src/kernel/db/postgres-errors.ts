/**
 * True when `error` is Postgres refusing a write because a row it points at
 * does not exist (SQLSTATE 23503), for the one foreign key `constraint`.
 *
 * Naming the constraint matters: a violation on another key of the same table
 * is a different problem and must not be mistaken for this one.
 */
export function isForeignKeyViolation(
  error: unknown,
  constraint: string,
): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint: violated } = error as {
    code?: unknown;
    constraint?: unknown;
  };
  return code === '23503' && violated === constraint;
}
