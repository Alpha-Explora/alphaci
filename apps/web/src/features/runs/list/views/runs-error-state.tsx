"use client";

/* `message` is always the view-model's user-safe error, never a raw ApiError. */
export function RunsErrorState({
  message,
  onRetry,
}: Readonly<{
  message: string;
  onRetry: () => void;
}>) {
  return (
    <div className="runs-error-state" role="alert">
      <div className="runs-error-body">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--danger)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="ghost-button"
        style={{
          padding: "0.35rem 1rem",
          fontSize: "0.82rem",
          minHeight: "2rem",
        }}
      >
        Retry
      </button>
    </div>
  );
}
