"use client";

/* Preserve the preferences probe's initial loading transition. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";

import { notificationsRepository } from "../../data/notifications-repository";
import { toUserError } from "../../model/notifications-rules";
import type {
  NotificationPreferences,
  NotificationsStatus,
} from "../../model/notifications-types";

export interface NotificationsPreferencesViewModel {
  preferences: NotificationPreferences | null;
  status: NotificationsStatus;
  isSaving: boolean;
  error: string | null;
  setInAppEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * ViewModel for the notification preferences panel.
 *
 * The panel previously fetched and saved from inside the component — a view by
 * location and a controller by behaviour. Both concerns now live here, leaving
 * the view to render `preferences`, `status` and a user-safe `error`.
 */
export function useNotificationsPreferencesViewModel(): NotificationsPreferencesViewModel {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [status, setStatus] = useState<NotificationsStatus>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void notificationsRepository
      .getPreferences()
      .then((next) => {
        if (!alive) return;
        setPreferences(next);
        setStatus("ready");
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setStatus("error");
        setError(
          toUserError(e, "Notification preferences are unavailable right now."),
        );
      });
    return () => {
      alive = false;
    };
  }, []);

  const setInAppEnabled = useCallback(async (enabled: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      /* Trusts the server's response rather than the optimistic value: this is
       * a settings toggle, so a silent divergence between what the switch shows
       * and what was stored would be worse than a brief delay. */
      setPreferences(
        await notificationsRepository.updatePreferences({
          inAppEnabled: enabled,
        }),
      );
    } catch (e) {
      setError(toUserError(e, "Notification preferences could not be saved."));
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { preferences, status, isSaving, error, setInAppEnabled };
}
