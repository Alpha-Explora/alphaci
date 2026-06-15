"use client";

import { useEffect, useState } from "react";

import type { NotificationPreferences } from "@/lib/api/contracts";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notifications";

export function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
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
        if (active) setMessage("Notification preferences are unavailable right now.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleInAppChange(enabled: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateNotificationPreferences({ inAppEnabled: enabled });
      setPreferences(updated);
    } catch {
      setMessage("Notification preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!preferences) {
    return (
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
        Loading notification preferences...
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label className="hover-field" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <span>
          <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "0.9rem" }}>
            In-app notifications
          </strong>
          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Show product events in FlowCI Studio.
          </span>
        </span>
        <input
          type="checkbox"
          checked={preferences.inAppEnabled}
          disabled={saving}
          onChange={(event) => void handleInAppChange(event.target.checked)}
        />
      </label>
      <label className="hover-field" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", opacity: 0.7 }}>
        <span>
          <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "0.9rem" }}>
            Email notifications
          </strong>
          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Email delivery unavailable.
          </span>
        </span>
        <input type="checkbox" checked={preferences.emailEnabled} disabled readOnly />
      </label>
      {message ? <p className="error-text" style={{ margin: 0 }}>{message}</p> : null}
    </div>
  );
}
