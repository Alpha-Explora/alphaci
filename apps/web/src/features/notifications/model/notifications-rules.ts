/* Pure domain rules. No React, no I/O — directly unit-testable. */

/** Turns any thrown value into something safe to render to a user. */
export function toUserError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
