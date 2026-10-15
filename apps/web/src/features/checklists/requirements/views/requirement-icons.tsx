/* Decorative icons for the requirements views. Each is aria-hidden: the
 * button or heading beside it always says the same thing in words. */

function Glyph({ children, size = 14 }: Readonly<{ children: React.ReactNode; size?: number }>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function ArrowUpIcon() {
  return (
    <Glyph>
      <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
    </Glyph>
  );
}

export function ArrowDownIcon() {
  return (
    <Glyph>
      <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
    </Glyph>
  );
}

/** A requirement card's dropdown: points down closed, turned up (by CSS) when open. */
export function ChevronDownIcon() {
  return (
    <Glyph size={13}>
      <path d="m4.25 6.25 3.75 3.75 3.75-3.75" />
    </Glyph>
  );
}

export function PlusIcon() {
  return (
    <Glyph>
      <path d="M8 3v10M3 8h10" />
    </Glyph>
  );
}

export function RemoveIcon() {
  return (
    <Glyph size={12}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Glyph>
  );
}

/** A Feature: a spark, something the product does. */
export function FeatureIcon() {
  return (
    <Glyph size={16}>
      <path d="M8 1.75v2.5M8 11.75v2.5M1.75 8h2.5M11.75 8h2.5M3.6 3.6l1.75 1.75M10.65 10.65l1.75 1.75M3.6 12.4l1.75-1.75M10.65 5.35l1.75-1.75" />
    </Glyph>
  );
}

/** A System requirement: a shield, something every repository must hold to. */
export function SystemIcon() {
  return (
    <Glyph size={16}>
      <path d="M8 1.75 2.75 3.75v4c0 3.1 2.2 5.5 5.25 6.5 3.05-1 5.25-3.4 5.25-6.5v-4Z" />
      <path d="m5.75 8 1.6 1.6 2.9-3.1" />
    </Glyph>
  );
}

export function RunIcon() {
  return (
    <Glyph>
      <path d="M3 2.75h10v10.5H3zM5.5 6l1.25 1.25L9.5 4.5M5.5 10.25h5" />
    </Glyph>
  );
}
