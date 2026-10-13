import type { HostingTone } from "../model/hosting-environment-rules";

/** A status dot; colour only, so its meaning is always said in text beside it. */
export function HostingDot({ tone }: Readonly<{ tone: HostingTone }>) {
  return <span aria-hidden="true" className={`hosting-dot hosting-dot--${tone}`} />;
}

/** A status pill: a dot and its word. */
export function HostingPill({ tone, label }: Readonly<{ tone: HostingTone; label: string }>) {
  return (
    <span className={`hosting-pill hosting-pill--${tone}`}>
      <HostingDot tone={tone} />
      {label}
    </span>
  );
}

/**
 * The provider's mark beside a service name: Vercel's triangle, Render's
 * letter in a rounded square. Decorative; the name beside it is the text.
 */
export function ProviderMark({ provider }: Readonly<{ provider: string }>) {
  return (
    <span aria-hidden="true" className={`hosting-service__mark hosting-service__mark--${provider}`}>
      {provider === "vercel" ? (
        <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
          <path d="M12 3.5 22 20.5H2z" fill="currentColor" />
        </svg>
      ) : (
        provider.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
