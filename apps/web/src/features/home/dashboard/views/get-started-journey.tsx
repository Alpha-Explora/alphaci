"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import type { ProvisionedProject, RunGroup } from "../../model/home-types";
import { EASE_OUT, sectionVariants } from "./motion";

/* ── Get-started journey — shown when the workspace is effectively empty ────── */

export function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function GetStartedJourney({
  projects,
  runs,
  historyCount,
  reduced,
}: Readonly<{
  projects: ProvisionedProject[];
  runs: RunGroup[];
  historyCount: number;
  reduced: boolean | null;
}>) {
  const hasProjects = projects.length > 0;
  const hasProvisioned = projects.some(
    (project) => project.status === "provisioned",
  );
  const hasWorkflow = historyCount > 0 || hasProvisioned;
  const hasRuns = runs.length > 0;

  const steps: Array<{
    title: string;
    desc: string;
    done: boolean;
    href?: string;
    cta?: string;
  }> = [
    {
      title: "Create a project",
      desc: "Name a service and pick what its pipeline should check.",
      done: hasProjects,
      href: "/workflows?tab=setup",
      cta: "Create a project",
    },
    {
      title: "Connect a repository",
      desc: "Link a GitHub repo — ALPHACI writes the Actions workflow into it.",
      done: hasProvisioned,
      href: "/workflows?tab=setup",
      cta: "Connect a repo",
    },
    {
      title: "Pipeline generated",
      desc: "Access, quality and package stages are committed to your repo.",
      done: hasWorkflow,
      href: "/workflows?tab=current",
      cta: "View workflows",
    },
    {
      title: "Push code, watch it run",
      desc: "Every push streams live per-stage status straight to your dashboard.",
      done: hasRuns,
      href: "/runs",
      cta: "Open runs",
    },
    {
      title: "Monitor & iterate",
      desc: "Track success rate, catch failing stages, and tune your pipeline.",
      done: false,
      href: "/guide",
      cta: "Read the guide",
    },
  ];

  const currentIndex = steps.findIndex((step) => !step.done);
  const activeIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;
  const completed = steps.filter((step) => step.done).length;

  return (
    <motion.section
      className="getstarted"
      aria-labelledby="getstarted-title"
      custom={2}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <div className="getstarted-intro">
        <p className="dashboard-section-kicker">GET STARTED</p>
        <h2 id="getstarted-title">Ship your first pipeline</h2>
        <p className="getstarted-lede">
          Your workspace is a clean slate. Follow the path below — each push you
          make will light up live here.
        </p>
        <div className="getstarted-progress" aria-hidden="true">
          <span className="getstarted-progress-bar">
            <motion.span
              className="getstarted-progress-fill"
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: completed / steps.length }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
            />
          </span>
          <span className="getstarted-progress-label">
            {completed} of {steps.length}
          </span>
        </div>
      </div>

      <ol className="getstarted-steps">
        {steps.map((step, index) => {
          const isCurrent = index === activeIndex && !step.done;
          return (
            <motion.li
              key={step.title}
              className={`getstarted-step${step.done ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.35,
                ease: EASE_OUT,
                delay: reduced ? 0 : 0.1 + index * 0.08,
              }}
            >
              <span className="getstarted-node" aria-hidden="true">
                {step.done ? <CheckMark /> : index + 1}
              </span>
              <div className="getstarted-copy">
                <strong>{step.title}</strong>
                <small>{step.desc}</small>
                {isCurrent && step.href ? (
                  <Link href={step.href} className="getstarted-cta">
                    {step.cta}
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
              <span className="getstarted-state" aria-hidden="true">
                {step.done ? "Done" : isCurrent ? "Now" : ""}
              </span>
            </motion.li>
          );
        })}
      </ol>

      <div className="getstarted-resources">
        <span className="ops-block-label">Resources</span>
        <div className="getstarted-resource-links">
          <Link href="/workflows?tab=setup">Create a project</Link>
          <Link href="/runs">View runs</Link>
          <Link href="/guide">Read the guide</Link>
        </div>
      </div>
    </motion.section>
  );
}

/** Container-less metric cell: a quiet mono figure on a hairline, not a card. */
