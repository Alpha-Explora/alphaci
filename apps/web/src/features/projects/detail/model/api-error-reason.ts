/**
 * The reason the server gave for a failed request, as a display string.
 *
 * The workflow-settings handlers used to `catch {}` and substitute a generic
 * sentence, so "Unable to create workflow update PR." was all anyone ever saw
 * — while the backend had said exactly why: the capability is disabled, the
 * preview raised validation warnings, no usable GitHub token is linked, or
 * GitHub itself refused the branch. Discarding that leaves someone with an
 * error they cannot act on and no way to find out more.
 *
 * Pure and exported so the extraction is testable. It returns a string, never
 * the error object, so views still receive display text only.
 */

import { ApiError } from "@/shared/api/request";
import { serverErrorMessage } from "@/shared/api/error-message";

/**
 * Read the server's message out of an error, falling back when there isn't one.
 *
 * Use the same safety checks as the shared request client while preserving the
 * caller's contextual fallback. Validation arrays become one display message.
 */
export function apiErrorReason(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  return serverErrorMessage(error.status, error.details) ?? fallback;
}
