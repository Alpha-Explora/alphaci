export type ClassValue = string | false | null | undefined;

/**
 * Join conditional class names.
 *
 * The SaaS frontend used clsx plus tailwind-merge. This frontend keeps its
 * dependency list flat, so conditional joining is done here directly. Callers
 * must not pass conflicting Tailwind utilities and rely on later-wins merging,
 * because nothing de-duplicates them.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
