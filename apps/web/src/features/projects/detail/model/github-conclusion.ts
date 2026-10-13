/* Which GitHub run conclusions mean the run failed. Pure.
 *
 * `startup_failure` is GitHub refusing to start the workflow at all (a bad
 * workflow file, a missing reusable workflow, a permission the caller lacks).
 * Nothing ran, but nothing passed either: it is a failure, and painting it in
 * the neutral grey of "skipped" or "cancelled" hid broken pipelines. */

const FAILED_CONCLUSIONS: ReadonlySet<string> = new Set([
  "failure",
  "timed_out",
  "startup_failure",
]);

/** True for a conclusion that means the run failed. Null (still going) is not. */
export function isFailedConclusion(conclusion: string | null | undefined): boolean {
  return FAILED_CONCLUSIONS.has(conclusion ?? "");
}
