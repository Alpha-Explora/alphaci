"use client";

import { useState } from "react";

import type { NotificationsResponse } from "@/lib/api/contracts";

export function NotificationCenter({
  notifications,
  onMarkRead,
}: {
  notifications: NotificationsResponse | null;
  onMarkRead: (id: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications?.unreadCount ?? 0;

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-center-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Notifications"
      >
        <span aria-hidden="true">!</span>
        {unreadCount > 0 ? (
          <span className="notification-center-count">{unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className="notification-center-panel" role="dialog" aria-label="Notifications">
          {notifications?.items.length ? (
            notifications.items.map((notification) => (
              <div key={notification.id} className="notification-center-item">
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  <span>{notification.eventCode}</span>
                </div>
                {notification.readAt ? (
                  <span className="notification-center-state">Read</span>
                ) : (
                  <button
                    type="button"
                    className="notification-center-action"
                    onClick={() => void onMarkRead(notification.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="notification-center-empty">No notifications.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
