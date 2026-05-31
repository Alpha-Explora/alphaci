export function PipelineLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="FlowCI Studio logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left node — source circle */}
      <circle cx="5" cy="16" r="4" fill="#1a56db" />
      {/* Connecting line left → center */}
      <line x1="9" y1="16" x2="13" y2="16" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" />
      {/* Center node — pipeline diamond */}
      <rect x="13" y="11" width="7" height="7" rx="1.5" fill="#1a56db" transform="rotate(45 16.5 14.5)" />
      {/* Connecting line center → right */}
      <line x1="20" y1="16" x2="24" y2="16" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" />
      {/* Right node — deploy circle (success green) */}
      <circle cx="27" cy="16" r="4" fill="#12b76a" />
      {/* Checkmark inside right node */}
      <polyline points="24.8,16 26.4,17.6 29.2,14.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
