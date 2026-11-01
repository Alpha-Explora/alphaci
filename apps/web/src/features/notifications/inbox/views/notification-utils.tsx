"use client";

import type { NotificationItem } from "../../model/notifications-types";

export function notificationTone(
  eventCode: string,
): "success" | "warning" | "info" {
  const code = eventCode.toLowerCase();
  if (code === "hierarchy.group.member_added") return "success";
  if (code.includes("failed") || code.includes("drift")) return "warning";
  if (code.includes("created") || code.includes("provisioned")) return "success";
  return "info";
}

export function notificationLabel(eventCode: string) {
  if (eventCode === "hierarchy.group.member_added") return "Workspace access";
  return eventCode
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatNotificationTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NotificationGlyph({ item }: { item: NotificationItem }) {
  const tone = notificationTone(item.eventCode);
  return (
    <span
      className={`notification-center-glyph notification-center-glyph--${tone}`}
      aria-hidden="true"
    >
      {tone === "success" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : tone === "warning" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      )}
    </span>
  );
}
