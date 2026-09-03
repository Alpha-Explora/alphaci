"use client";

import Link from "next/link";
import { Fragment } from "react";
import { motion } from "framer-motion";

import {
  RUN_STAGE_LABELS,
  RUN_STAGE_ORDER,
  connectorTone,
  shortRepoName,
  timeAgo,
} from "../../model/home-rules";
import type {
  RunGroup,
  RunOverallStatus,
  RunStats,
  StageStatus,
} from "../../model/home-types";
import { QuickActionRunIcon } from "./dashboard-chrome";
import { EASE_OUT, sectionVariants } from "./motion";

/* ── Sparkline of recent run outcomes (oldest → newest, left → right) ───────── */

export function RunSparkline({
  outcomes,
  reduced,
}: Readonly<{ outcomes: RunOverallStatus[]; reduced: boolean | null }>) {
  if (!outcomes.length) {
    return <p className="ops-empty">Outcomes appear after your first run.</p>;
  }
  const bars = outcomes.slice(0, 14).reverse();
  return (
    <div
      className="ops-spark"
      role="img"
      aria-label={`Last ${bars.length} run outcomes, oldest to newest`}
    >
      {bars.map((outcome, index) => (
        <motion.span
          key={index}
          className={`ops-spark-bar ops-spark-bar--${outcome}`}
          title={outcome}
          initial={reduced ? false : { scaleY: 0.15, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            delay: reduced ? 0 : index * 0.028,
            duration: 0.32,
            ease: EASE_OUT,
          }}
        />
      ))}
    </div>
  );
}


/* ── Run activity card — the star: a full-width horizontal pipeline track ───── */

const runListVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const runCardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
};


export function RunActivityCard({
  run,
  reduced,
  featured = false,
}: Readonly<{ run: RunGroup; reduced: boolean | null; featured?: boolean }>) {
  const repoShort = shortRepoName(run.repoFullName);
  const stageMap = new Map(run.stages.map((stage) => [stage.stage, stage]));
  const stages = RUN_STAGE_ORDER.map((stage) => ({
    id: stage,
    status: (stageMap.get(stage)?.status ?? "pending") as StageStatus,
  }));
  const stageSummary = stages
    .map((stage) => `${RUN_STAGE_LABELS[stage.id]} ${stage.status}`)
    .join(", ");

  return (
    <motion.div
      className={`run-card run-card--${run.overallStatus}${featured ? " run-card--featured" : ""}`}
      variants={reduced ? undefined : runCardVariants}
    >
      <Link
        href="/runs"
        className="run-card-link"
        aria-label={`Run for ${repoShort} on ${run.branch}, ${run.overallStatus}. ${stageSummary}. Started ${timeAgo(run.startedAt)}. View run details.`}
      >
        <span className="run-card-accent" aria-hidden="true" />

        <div className="run-card-main">
          <div className="run-card-head">
            <span className="run-card-repo">{repoShort}</span>
            <span className="run-card-branch-pill">{run.branch}</span>
            {run.overallStatus === "running" ? (
              <span className="run-status-live" aria-hidden="true" />
            ) : null}
          </div>

          <div className="run-track" aria-hidden="true">
            <span className="run-track-cap">{RUN_STAGE_LABELS.access}</span>
            <div className="run-track-line">
              {stages.map((stage, index) => {
                const seg =
                  index > 0
                    ? connectorTone(stages[index - 1].status, stage.status)
                    : null;
                return (
                  <Fragment key={stage.id}>
                    {seg ? (
                      <span
                        className={`run-track-seg run-track-seg--${seg}`}
                      />
                    ) : null}
                    <span
                      className={`run-track-dot pipeline-dot pipeline-dot--${stage.status}`}
                    />
                  </Fragment>
                );
              })}
            </div>
            <span className="run-track-cap">{RUN_STAGE_LABELS.package}</span>
          </div>

          <div className="run-card-foot">
            <span className="run-card-time">{timeAgo(run.startedAt)}</span>
            <span className="run-card-sha">{run.commitSha.slice(0, 7)}</span>
          </div>
        </div>

        <div className="run-card-side">
          <span className={`run-status-word run-status-word--${run.overallStatus}`}>
            {run.overallStatus}
          </span>
          <span className="run-card-cta">
            View
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function RunCardSkeleton() {
  return (
    <div className="run-card run-card--skeleton" aria-hidden="true">
      <div className="run-card-link">
        <div className="run-card-main">
          <div className="run-card-head">
            <span className="run-skel run-skel--repo" />
          </div>
          <div className="run-skel run-skel--track" />
          <div className="run-skel run-skel--foot" />
        </div>
        <span className="run-skel run-skel--pill" />
      </div>
    </div>
  );
}

/* ── Pipeline Activity — the animated runs hero ─────────────────────────────── */

interface AttentionItem {
  tone: string;
  label: string;
  detail: string;
  href: string;
}

export function PipelineActivity({
  runs,
  stats,
  loading,
  reduced,
  attentionItems,
}: Readonly<{
  runs: RunGroup[];
  stats: RunStats;
  loading: boolean;
  reduced: boolean | null;
  attentionItems: AttentionItem[];
}>) {
  const runningCount = stats.running;
  const latest = runs[0] ?? null;
  const rest = runs.slice(1, 4);

  return (
    <motion.section
      className="runs-hero"
      aria-labelledby="runs-hero-title"
      custom={3}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <div className="dashboard-panel-heading runs-hero-heading">
        <div>
          <p className="dashboard-section-kicker">PIPELINE ACTIVITY</p>
          <h2 id="runs-hero-title">Latest runs</h2>
        </div>
        <div className="runs-hero-heading-right">
          {runningCount > 0 ? (
            <span className="runs-live-badge">
              <span className="runs-live-dot" aria-hidden="true" />
              {runningCount} running
            </span>
          ) : null}
          <Link href="/runs" className="dashboard-inline-link">
            {runs.length ? `View all ${runs.length} runs` : "Open runs"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* Operational signal folded in from the retired scope banner:
         the one line answering "is anything wrong?". */}
      <PipelineSignals loading={loading} attentionItems={attentionItems} />
      <RunsStream loading={loading} latest={latest} rest={rest} reduced={reduced} />

      {/* Recent outcomes sparkline pinned at the foot of the hero. */}
      <div className="runs-outcomes ops-block">
        <span className="ops-block-label">Recent outcomes</span>
        <RunSparkline outcomes={stats.outcomes} reduced={reduced} />
      </div>
    </motion.section>
  );
}

function PipelineSignals({ loading, attentionItems }: Readonly<{ loading: boolean; attentionItems: AttentionItem[] }>) {
  if (loading) return <div className="runs-hero-status" role="status"><span className="runs-hero-signal runs-hero-signal--idle">Refreshing signals…</span></div>;
  if (attentionItems.length) return <div className="runs-hero-status" role="status">{attentionItems.map((item) => <Link key={item.label} href={item.href} className={`runs-hero-chip runs-hero-chip--${item.tone}`} title={item.detail}><span className="runs-hero-chip-dot" aria-hidden="true" />{item.label}<span aria-hidden="true">→</span></Link>)}</div>;
  return <div className="runs-hero-status" role="status"><span className="runs-hero-signal"><span className="runs-hero-chip-dot" aria-hidden="true" />All systems operational</span></div>;
}

function RunsStream({ loading, latest, rest, reduced }: Readonly<{ loading: boolean; latest: RunGroup | null; rest: RunGroup[]; reduced: boolean | null }>) {
  if (loading) return <div className="runs-stream"><RunCardSkeleton /><RunCardSkeleton /></div>;
  if (!latest) return <EmptyRuns />;
  return <motion.div className="runs-stream" variants={reduced ? undefined : runListVariants} initial={reduced ? false : "hidden"} animate="visible"><RunActivityCard run={latest} reduced={reduced} featured />{rest.map((run) => <RunActivityCard key={run.runId} run={run} reduced={reduced} />)}</motion.div>;
}

function EmptyRuns() {
  return <div className="runs-stream"><Link href="/workflows?tab=setup" className="runs-empty"><span className="runs-empty-icon" aria-hidden="true"><QuickActionRunIcon /></span><span><strong>No runs yet</strong><small>Push to a provisioned repository and its per-stage status streams in here live.</small></span><span className="dashboard-row-arrow" aria-hidden="true">→</span></Link></div>;
}

