"use client";

import "./qa-alerts.css";

import Link from "next/link";

import {
  notificationAlertHref,
  isMembershipNotification,
} from "../../model/notifications-rules";
import type { NotificationItem } from "../../model/notifications-types";

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      className="qa-alert__icon"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.75v3.75M8 10.9v.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * QA's refusals, popped up in the corner as they arrive: "QA blocked "…" in
 * Check", QA's notes, a link to the item and a way to dismiss it. Each stays
 * until dismissed or opened; the Inbox keeps it unread either way. Announced
 * politely, so it never interrupts what a screen reader is saying.
 */
export function QaAlertToasts({
  alerts,
  onDismiss,
  onOpen,
}: Readonly<{
  alerts: ReadonlyArray<NotificationItem>;
  onDismiss: (id: string) => void;
  onOpen?: (id: string) => void;
}>) {
  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      className="qa-alerts"
      role="region"
    >
      {alerts.map((alert) => {
        const href = notificationAlertHref(alert);
        return (
          <div
            className="qa-alert"
            data-event={alert.eventCode}
            key={alert.id}
            role="status"
          >
            <AlertIcon />
            <div className="qa-alert__body">
              <p className="qa-alert__title">{alert.title}</p>
              {alert.body ? (
                <p className="qa-alert__text">{alert.body}</p>
              ) : null}
              {href ? (
                <Link
                  className="qa-alert__open"
                  href={href}
                  onClick={() => {
                    onOpen?.(alert.id);
                    onDismiss(alert.id);
                  }}
                >
                  {isMembershipNotification(alert)
                    ? "Open workspace"
                    : "Open item"}
                </Link>
              ) : null}
            </div>
            <button
              aria-label={`Dismiss: ${alert.title}`}
              className="qa-alert__dismiss"
              onClick={() => onDismiss(alert.id)}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="14"
                viewBox="0 0 16 16"
                width="14"
              >
                <path
                  d="m4.5 4.5 7 7m0-7-7 7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.6"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
