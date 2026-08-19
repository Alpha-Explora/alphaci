"use client";

import { useCallback, useEffect, useState } from "react";

import type { NotificationPreferences } from "../api/notifications.contracts";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../api/notifications.api";

export interface NotificationPrefsViewModel {
  preferences: NotificationPreferences | null;
  isSaving: boolean;
  message: string | null;
  setInAppEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * ViewModel for the notification preferences panel.
 *
 * Extracted so `NotificationPreferencesSection` stops fetching its own data.
 * The component was a View by location and a Controller by behaviour, which is
 * exactly what the `view-must-not-fetch` boundary rule exists to prevent — the
 * rule flagged it during this migration rather than at review time.
 */
export function useNotificationPrefs(): NotificationPrefsViewModel {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getNotificationPreferences()
      .then((response) => {
        if (!alive) return;
        setPreferences(response);
        setMessage(null);
      })
      .catch(() => {
        if (alive) {
          setMessage("Notification preferences are unavailable right now.");
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const setInAppEnabled = useCallback(async (enabled: boolean) => {
    setIsSaving(true);
    setMessage(null);
    try {
      /* Trusts the server's response rather than the optimistic value: this is
       * a settings toggle, so a silent divergence between what the switch shows
       * and what the backend stored would be worse than a brief delay. */
      const updated = await updateNotificationPreferences({
        inAppEnabled: enabled,
      });
      setPreferences(updated);
    } catch {
      setMessage("Notification preferences could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { preferences, isSaving, message, setInAppEnabled };
}
