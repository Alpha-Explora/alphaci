/*
 * When a live log has gone quiet. A free instance on a host like Render stops
 * after 15 minutes without traffic and writes nothing until the next request
 * wakes it, so a tail whose newest line is hours old is usually a sleeping
 * service, not a broken feed. Pure; the caller passes the clock.
 */

/** How long a live tail may stay silent before it says so. */
export const QUIET_AFTER_MS = 15 * 60_000;

/** The newest line's timestamp when the tail has been silent past QUIET_AFTER_MS, else null. */
export function quietSince(
  lines: ReadonlyArray<{ timestamp: string }>,
  now: number,
): string | null {
  let newest: string | null = null;
  let newestAt = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const at = Date.parse(line.timestamp);
    if (!Number.isNaN(at) && at > newestAt) {
      newestAt = at;
      newest = line.timestamp;
    }
  }
  if (newest === null || now - newestAt < QUIET_AFTER_MS) return null;
  return newest;
}

/** "20 minutes ago", "5 hours ago", "3 days ago". */
export function quietAgo(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
