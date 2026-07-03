"use client";

import { useEffect, useState } from "react";

import type { NotificationPreferences } from "@/lib/api/contracts";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notifications";

export function NotificationPreferencesSection() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getNotificationPreferences()
      .then((response) => {
        if (!active) return;
        setPreferences(response);
        setMessage(null);
      })
      .catch(() => {
        if (active)
          setMessage("Notification preferences are unavailable right now.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleInAppChange(enabled: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateNotificationPreferences({
        inAppEnabled: enabled,
      });
      setPreferences(updated);
    } catch {
      setMessage("Notification preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!preferences) {
    return (
      <div className="notification-preferences-card notification-preferences-card--loading">
        <span className="notification-preferences-skeleton" />
        <span className="notification-preferences-skeleton notification-preferences-skeleton--short" />
      </div>
    );
  }

  return (
    <div className="notification-preferences">
      <label
        className={`notification-preferences-card ${
          preferences.inAppEnabled
            ? "notification-preferences-card--enabled"
            : ""
        }`}
      >
        <span className="notification-preferences-copy">
          <span className="notification-preferences-kicker">Live inbox</span>
          <strong>
            In-app notifications
          </strong>
          <span>
            Show workflow PRs, project updates, and account events in the
            product notification center.
          </span>
        </span>
        <span className="notification-preferences-toggle">
          <input
            type="checkbox"
            checked={preferences.inAppEnabled}
            disabled={saving}
            onChange={(event) => void handleInAppChange(event.target.checked)}
          />
          <span aria-hidden="true" />
        </span>
      </label>
      <label
        className="notification-preferences-card notification-preferences-card--disabled"
      >
        <span className="notification-preferences-copy">
          <span className="notification-preferences-kicker">Digest</span>
          <strong>
            Email notifications
          </strong>
          <span>
            Reserved for workflow digests and failed-run summaries.
          </span>
        </span>
        <span className="notification-preferences-state">Soon</span>
      </label>
      {message ? (
        <p className="error-text" style={{ margin: 0 }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
