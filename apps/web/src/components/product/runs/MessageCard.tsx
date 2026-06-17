"use client";

import type { FriendlyMessage } from "@/lib/api/contracts";
import { severityColors } from "@/lib/runs/utils";

interface MessageCardProps {
  message: FriendlyMessage;
  githubRunUrl: string;
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SeverityIcon({ severity }: { severity: FriendlyMessage["severity"] }) {
  switch (severity) {
    case "error":   return <ErrorIcon />;
    case "warning": return <WarningIcon />;
    case "info":    return <InfoIcon />;
    case "success": return <SuccessIcon />;
  }
}

export function MessageCard({ message, githubRunUrl }: MessageCardProps) {
  const colors = severityColors(message.severity);

  return (
    <div
      className="runs-message-card"
      style={{
        borderLeft: `3px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: "0 0.6rem 0.6rem 0",
        padding: "0.75rem 1rem",
        display: "grid",
        gap: "0.35rem",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ color: colors.icon, flexShrink: 0, display: "flex" }}>
          <SeverityIcon severity={message.severity} />
        </span>
        <p style={{
          margin: 0,
          fontSize: "0.84rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.3,
        }}>
          {message.title}
        </p>
      </div>

      {/* Detail */}
      <p style={{
        margin: 0,
        fontSize: "0.8rem",
        color: "var(--text-secondary)",
        lineHeight: 1.55,
        paddingLeft: "1.1rem",
      }}>
        {message.detail}
      </p>

      {/* Failure items list */}
      {message.items && message.items.length > 0 && (
        <ul
          role="list"
          style={{
            margin: "0.15rem 0 0",
            padding: 0,
            paddingLeft: "1.1rem",
            listStyle: "none",
            display: "grid",
            gap: "0.25rem",
          }}
        >
          {message.items.map((item, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.45rem",
                fontSize: "0.78rem",
                lineHeight: 1.45,
              }}
            >
              {/* Severity-colored dot marker */}
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: colors.icon,
                  opacity: 0.65,
                  marginTop: "0.38em",
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {item.label}
                </span>
                {item.sub && (
                  <span
                    style={{
                      marginLeft: "0.4rem",
                      color: "var(--text-muted)",
                      fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
                      fontSize: "0.73rem",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {item.sub}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Hint */}
      {message.hint && (
        <p style={{
          margin: 0,
          fontSize: "0.74rem",
          color: "var(--text-muted)",
          lineHeight: 1.5,
          paddingLeft: "1.1rem",
          fontStyle: "italic",
        }}>
          {message.hint}
        </p>
      )}

      {/* GitHub link */}
      <a
        href={githubRunUrl}
        target="_blank"
        rel="noreferrer"
        className="runs-gh-link"
        style={{
          marginTop: "0.35rem",
          marginLeft: "1.1rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          fontSize: "0.72rem",
          color: "var(--brand)",
          fontWeight: 600,
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        View full logs on GitHub
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </a>
    </div>
  );
}
