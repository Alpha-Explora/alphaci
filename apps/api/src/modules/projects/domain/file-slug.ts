/**
 * A name reduced to `a-z`, `0-9` and single dashes, with no dash at either
 * end: for branch names and generated workflow file names. Empty when nothing
 * usable is left.
 *
 * Trims dashes with a loop rather than `/^-+|-+$/`, which backtracks
 * quadratically on a long run of dashes that does not end the string.
 */
export function fileSlug(value: string): string {
  const dashed = value.toLowerCase().replaceAll(/[^a-z0-9-]+/g, '-');
  let start = 0;
  let end = dashed.length;
  while (start < end && dashed[start] === '-') start += 1;
  while (end > start && dashed[end - 1] === '-') end -= 1;
  return dashed.slice(start, end);
}
