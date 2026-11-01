/**
 * Provider rate limiting, as the logs view reads it.
 *
 * A host that answers 429 is asking for fewer reads, not reporting an outage.
 * The backend keeps the stream open and says when it will read again; these
 * helpers turn that into the wording and the clock the notice needs.
 */

/** Used when the backend says it is rate limited but not for how long. */
export const DEFAULT_RETRY_AFTER_MS = 60_000;

/** The word on a reason string that means "slow down", not "broken". */
const RATE_LIMIT_REASON = /\b429\b|rate[\s_-]?limit/i;

/** An older backend reports a 429 as `unavailable` with the raw body as the reason. */
export function isRateLimitReason(reason: string | null | undefined): boolean {
  return typeof reason === "string" && RATE_LIMIT_REASON.test(reason);
}

/** The instant (epoch ms) the cooldown ends, from now and the backend's wait. */
export function cooldownEnd(now: number, retryAfterMs: number | undefined): number {
  return now + (retryAfterMs ?? DEFAULT_RETRY_AFTER_MS);
}

/** Whole seconds left, rounded up so the notice never shows 0s while waiting. */
export function secondsUntil(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** "Render is limiting log reads · retrying in 42s". */
export function rateLimitNotice(label: string, seconds: number): string {
  const wait = seconds > 0 ? `retrying in ${String(seconds)}s` : "retrying now";
  return `${label} is limiting log reads · ${wait}`;
}

/** What an older backend's raw 429 body becomes. */
export const LEGACY_RATE_LIMIT_TEXT =
  "The host is rate-limiting log reads right now. Retry in a minute.";
