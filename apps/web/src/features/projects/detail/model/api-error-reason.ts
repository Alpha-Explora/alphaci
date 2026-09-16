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

/**
 * Read the server's message out of an error, falling back when there isn't one.
 *
 * The reason comes from `details`, NOT from `error.message`. `request.ts` sets
 * the message to "Request failed with status 400" and puts the parsed response
 * body in `details`, so reading `message` would trade one useless sentence for
 * another. Nest replies `{statusCode, message, error}`, and `message` is an
 * array of strings when class-validator rejected the body.
 */
export function apiErrorReason(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  const body = error.details;
  if (typeof body !== "object" || body === null || !("message" in body)) {
    return fallback;
  }

  const { message } = body as { message: unknown };

  if (Array.isArray(message)) {
    // Validation errors arrive as one string per broken rule. Joined rather
    // than truncated to the first: a caller that got three wrong wants three.
    const joined = message
      .filter((part): part is string => typeof part === "string")
      .join(" ");
    return joined.trim() === "" ? fallback : joined;
  }

  if (typeof message === "string" && message.trim() !== "") return message;

  return fallback;
}
