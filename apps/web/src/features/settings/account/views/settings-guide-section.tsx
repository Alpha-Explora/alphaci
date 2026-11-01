"use client";

import Link from "next/link";

import { BookOpenIcon, SettingsSection } from "./settings-chrome";

const GUIDE_TOPICS = [
  "Getting started — sign in, install the GitHub App",
  "Creating a project — repo shapes, framework, recipe",
  "Branch strategy — test → uat → main promotion flow",
  "CI/CD quality gates — lint, tests, security, E2E",
  "Managing projects — current projects and catalog",
  "FAQ and troubleshooting",
] as const;

export function SettingsGuideSection() {
  return (
    <SettingsSection icon={<BookOpenIcon />} title="Guide" index={0}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.88rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          ALPHACI turns a blank idea into a working repository in one step —
          GitHub repo, protected branches, and a ready-to-run CI/CD pipeline,
          all committed automatically.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            What is covered
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            {GUIDE_TOPICS.map((topic) => (
              <div
                key={topic}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.55rem",
                  fontSize: "0.84rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "var(--brand)",
                    marginTop: "0.45em",
                    flexShrink: 0,
                  }}
                />
                {topic}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            flexWrap: "wrap",
            paddingTop: "0.25rem",
            borderTop: "1px solid var(--border-soft)",
          }}
        >
          <Link
            href="/guide"
            className="primary-button"
            style={{
              fontSize: "0.82rem",
              padding: "0.45rem 1.1rem",
            }}
          >
            Open full guide
          </Link>
          <Link
            href="/workflows?tour=1"
            className="ghost-button"
            style={{
              fontSize: "0.82rem",
              padding: "0.45rem 1.1rem",
            }}
            aria-label="Replay the guided product tour on the Workflows Setup tab"
          >
            Replay guided tour
          </Link>
        </div>
      </div>
    </SettingsSection>
  );
}
