"use client";

import { useNotificationsPreferencesViewModel } from "../view-models/use-notifications-preferences-view-model";

export function NotificationsPreferencesView() {
  /* View only — state and persistence live in the ViewModel. */
  const {
    preferences,
    isSaving: saving,
    error: message,
    setInAppEnabled,
  } = useNotificationsPreferencesViewModel();

  const handleInAppChange = (enabled: boolean) => void setInAppEnabled(enabled);

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
