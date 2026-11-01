/* Stroke icons drawn at the same weight as the hierarchy state icons, so
 * nothing on the team page looks imported from another icon set. */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function ChecklistGlyph({ size = 18 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="m3.5 6 1.2 1.2L7 5" />
      <path d="m3.5 12 1.2 1.2L7 11" />
      <path d="m3.5 18 1.2 1.2L7 17" />
    </svg>
  );
}

export function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
