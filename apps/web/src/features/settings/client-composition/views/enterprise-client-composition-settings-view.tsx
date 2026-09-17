"use client";

import type { ClientCompositionInfo } from "@/shared/api/contracts";

export function EnterpriseClientCompositionSettingsView({
  composition,
}: Readonly<{
  composition: ClientCompositionInfo | null;
}>) {
  if (!composition?.enabled) return null;

  return (
    <section
      className="settings-card"
      aria-labelledby="client-composition-settings-title"
    >
      <div aria-hidden="true" className="settings-card-accent" />
      <div className="settings-card-header">
        <span className="settings-card-icon" aria-hidden="true">
          ◈
        </span>
        <span
          className="settings-card-title"
          id="client-composition-settings-title"
        >
          Enterprise client composition
        </span>
      </div>
      <div className="settings-section-body">
        <p className="client-composition-summary">
          This deployment is narrowed by a deny-only client policy selected at
          startup. This surface is read-only; policy changes require deployment
          configuration and a restart.
        </p>
        <dl className="client-composition-details">
          <div>
            <dt>Client</dt>
            <dd>{composition.displayName ?? composition.clientId ?? "—"}</dd>
          </div>
          <div>
            <dt>Client ID</dt>
            <dd>
              <code>{composition.clientId ?? "—"}</code>
            </dd>
          </div>
          <div>
            <dt>Edition</dt>
            <dd>{composition.edition ?? "—"}</dd>
          </div>
        </dl>
        <div className="client-composition-policy">
          <span className="client-composition-policy-label">
            Disabled capabilities
          </span>
          {composition.disabledCapabilities.length > 0 ? (
            <ul>
              {composition.disabledCapabilities.map((key) => (
                <li key={key}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p>No capabilities are disabled by this policy.</p>
          )}
        </div>
      </div>
    </section>
  );
}
