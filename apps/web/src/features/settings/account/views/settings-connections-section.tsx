"use client";

import Link from "next/link";

import {
  ExternalLinkIcon,
  GithubIcon,
  SettingsSection,
} from "./settings-chrome";

export function SettingsConnectionsSection() {
  return (
    <SettingsSection icon={<GithubIcon />} title="GitHub Connection" index={0}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span className="dash-status-active" />
            <span
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              GitHub App connected
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
            }}
          >
            Manage your GitHub App connection from the Create Project page.
          </p>
        </div>
        <Link href="/workflows" className="dash-action-btn">
          Manage
          <ExternalLinkIcon size={11} />
        </Link>
      </div>
    </SettingsSection>
  );
}
