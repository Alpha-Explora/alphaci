/* Line icons for the project explorer. 16px, currentColor, decorative. */

function Svg({ children, size = 16 }: Readonly<{ children: React.ReactNode; size?: number }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function FolderIcon({ size }: Readonly<{ size?: number }>) {
  return (
    <Svg size={size}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

export function InboxIcon({ size }: Readonly<{ size?: number }>) {
  return (
    <Svg size={size}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
  );
}

/** Settings sliders: "Manage" a Project (repositories, Move, checklists, Delete). */
export function SlidersIcon() {
  return (
    <Svg size={14}>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </Svg>
  );
}

export function ChevronIcon() {
  return (
    <Svg>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function BackIcon() {
  return (
    <Svg>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function PlusIcon() {
  return (
    <Svg>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export function ChecklistIcon() {
  return (
    <Svg size={14}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

export function StudioIcon() {
  return (
    <Svg>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </Svg>
  );
}

export function CloseIcon() {
  return (
    <Svg size={14}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}
