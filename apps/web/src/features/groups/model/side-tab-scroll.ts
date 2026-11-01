/* Pure geometry for the side-tab rail. No React, no DOM access. */

export interface HorizontalSpan {
  left: number;
  right: number;
}

/**
 * How far a horizontally scrolling strip must move so an item is fully in
 * view, plus `padding` of breathing room. Negative scrolls left, positive
 * scrolls right, 0 means it is already visible.
 *
 * Below the tablet breakpoint the vertical side rail becomes a scrolling row,
 * and a section opened by deep link (or chosen further down the list) would
 * otherwise sit off-screen with nothing showing which section is open.
 */
export function revealScrollDelta(
  strip: HorizontalSpan,
  item: HorizontalSpan,
  padding = 12,
): number {
  if (item.left < strip.left) return item.left - strip.left - padding;
  if (item.right > strip.right) return item.right - strip.right + padding;
  return 0;
}
