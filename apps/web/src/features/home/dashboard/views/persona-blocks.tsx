"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { HEALTH_BRANCHES } from "../../model/home-run-rules";
import type {
  BranchHealthRow,
  HomeBlockState,
  HomeMetric,
  HomeSectionStates,
  PersonaDashboard,
  RepoRunTone,
} from "../../model/home-persona-types";
import { shortRepoName } from "../../model/home-rules";
import type { ProjectTone, ProvisionedProject, RunGroup } from "../../model/home-types";
import { EASE_OUT, sectionVariants } from "./motion";
import { RunActivityCard } from "./pipeline-activity";
import { DashboardMetric } from "./workspace-overview";

/* ── Shared pieces of a role's Home ──────────────────────────────────────── */

/** What every block renders from. */
export interface BlockContext {
  data: PersonaDashboard;
  states: HomeSectionStates;
  reduced: boolean | null;
  /** The team's provisioned projects (the team dashboard's project list). */
  projects: ProvisionedProject[];
  /** Entrance order, for the section stagger. */
  order: number;
  /** A side block's slot class; empty in the main column. */
  slotClass: string;
}

/** The run-status dot tone, on the team dashboard's dot classes. */
export const RUN_TONE_DOT: Readonly<Record<RepoRunTone, ProjectTone>> = {
  success: "ok",
  failure: "danger",
  running: "warn",
  warning: "warn",
  none: "muted",
};

export const RUN_TONE_LABEL: Readonly<Record<RepoRunTone, string>> = {
  success: "passed",
  failure: "failed",
  running: "running",
  warning: "partial or cancelled",
  none: "no run yet",
};

export function StatusDot({ tone, label }: Readonly<{ tone: ProjectTone; label?: string }>) {
  if (!label) return <span className={`team-status-dot team-status-dot--${tone}`} aria-hidden="true" />;
  return <span className={`team-status-dot team-status-dot--${tone}`} role="img" aria-label={label} />;
}

function BlockSkeleton() {
  return (
    <div className="home-skeleton" role="status" aria-label="Loading">
      <span className="home-skeleton-row" />
      <span className="home-skeleton-row" />
      <span className="home-skeleton-row home-skeleton-row--short" />
    </div>
  );
}

/** Loading, a user-safe error, or the block's own content. */
export function BlockBody({ state, children }: Readonly<{ state: HomeBlockState; children: ReactNode }>) {
  if (state.loading) return <BlockSkeleton />;
  if (state.error) {
    return (
      <p className="dashboard-empty home-block-error" role="alert">
        {state.error}
      </p>
    );
  }
  return <>{children}</>;
}

export function EmptyLine({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="dashboard-empty">{children}</p>;
}

export function InlineLink({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <Link href={href} className="dashboard-inline-link">
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/**
 * A main-column block: a kicker, a title, an optional action, and a body that
 * scrolls inside the block so Home itself never scrolls.
 */
export function HomeBlock({
  id,
  kicker,
  title,
  action,
  note,
  state,
  reduced,
  order,
  children,
}: Readonly<{
  id: string;
  kicker: string;
  title: string;
  action?: ReactNode;
  note?: string | null;
  state: HomeBlockState;
  reduced: boolean | null;
  order: number;
  children: ReactNode;
}>) {
  return (
    <motion.section
      className="home-block"
      aria-labelledby={`${id}-title`}
      custom={order}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <div className="dashboard-panel-heading home-block-heading">
        <div>
          <p className="dashboard-section-kicker">{kicker}</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        {action}
      </div>
      {note ? <p className="home-block-note">{note}</p> : null}
      <div className="home-block-body">
        <BlockBody state={state}>{children}</BlockBody>
      </div>
    </motion.section>
  );
}

/** A side-column block on the slim rail: kicker, optional action, a list that scrolls. */
export function HomeSideBlock({
  id,
  kicker,
  action,
  note,
  state,
  slotClass,
  children,
}: Readonly<{
  id: string;
  kicker: string;
  action?: ReactNode;
  note?: string | null;
  state: HomeBlockState;
  /** side-rail-block--grow for the first slot, side-rail-block--divided for the second. */
  slotClass: string;
  children: ReactNode;
}>) {
  return (
    <section className={`side-rail-block ${slotClass}`} aria-labelledby={`${id}-title`}>
      <div className="side-rail-head">
        <p className="dashboard-section-kicker" id={`${id}-title`}>
          {kicker}
        </p>
        {action}
      </div>
      {note ? <p className="home-block-note">{note}</p> : null}
      <div className="side-rail-scroll">
        <BlockBody state={state}>{children}</BlockBody>
      </div>
    </section>
  );
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

/** A list whose rows stagger in (once, and not at all with reduced motion). */
export function HomeRowList({
  label,
  reduced,
  children,
}: Readonly<{ label: string; reduced: boolean | null; children: ReactNode }>) {
  return (
    <motion.ul
      className="home-row-list"
      aria-label={label}
      variants={reduced ? undefined : listVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      {children}
    </motion.ul>
  );
}

export function HomeRow({ reduced, children }: Readonly<{ reduced: boolean | null; children: ReactNode }>) {
  return <motion.li variants={reduced ? undefined : rowVariants}>{children}</motion.li>;
}

/* ── Metrics ────────────────────────────────────────────────────────────── */

export function PersonaMetricsRail({
  metrics,
  loading,
  reduced,
}: Readonly<{ metrics: ReadonlyArray<HomeMetric>; loading: boolean; reduced: boolean | null }>) {
  return (
    <motion.section
      className="metrics-rail metrics-rail--five"
      aria-label="Workspace metrics"
      custom={1}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      {metrics.map((metric) => (
        <DashboardMetric
          key={metric.id}
          value={metric.value}
          label={metric.label}
          loading={loading}
          reduced={reduced}
          href={metric.href ?? undefined}
          suffix={metric.suffix}
        />
      ))}
    </motion.section>
  );
}

/* ── Segmented bar ──────────────────────────────────────────────────────── */

export interface BarSegment {
  key: string;
  value: number;
  /** A home-seg-part--<tone> class. */
  tone: string;
}

/** Proportional parts of one whole; each part grows in from the left. */
export function SegmentBar({
  segments,
  label,
  reduced,
}: Readonly<{ segments: ReadonlyArray<BarSegment>; label: string; reduced: boolean | null }>) {
  return (
    <span className="home-seg" role="img" aria-label={label}>
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <motion.span
            key={segment.key}
            className={`home-seg-part home-seg-part--${segment.tone}`}
            style={{ flexGrow: segment.value }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          />
        ))}
    </span>
  );
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

const RUNS_SHOWN = 8;

/** The run cards of the team dashboard, for the runs a role's Home covers. */
export function RunsBlock({
  id,
  kicker,
  title,
  runs,
  running,
  emptyText,
  state,
  reduced,
  order,
}: Readonly<{
  id: string;
  kicker: string;
  title: string;
  runs: ReadonlyArray<RunGroup>;
  running: number;
  emptyText: string;
  state: HomeBlockState;
  reduced: boolean | null;
  order: number;
}>) {
  const action = (
    <div className="runs-hero-heading-right">
      {running > 0 ? (
        <span className="runs-live-badge">
          <span className="runs-live-dot" aria-hidden="true" />
          {running} running
        </span>
      ) : null}
      <InlineLink href="/runs">All runs</InlineLink>
    </div>
  );
  return (
    <HomeBlock id={id} kicker={kicker} title={title} action={action} state={state} reduced={reduced} order={order}>
      {runs.length ? (
        <div className="runs-stream home-runs-stream">
          {runs.slice(0, RUNS_SHOWN).map((run, index) => (
            <RunActivityCard key={run.runId} run={run} reduced={reduced} featured={index === 0} />
          ))}
        </div>
      ) : (
        <EmptyLine>{emptyText}</EmptyLine>
      )}
    </HomeBlock>
  );
}

/* ── Branch health ──────────────────────────────────────────────────────── */

function RepoCell({ row }: Readonly<{ row: BranchHealthRow }>) {
  const name = shortRepoName(row.repoFullName);
  if (!row.href) return <span className="home-branch-repo">{name}</span>;
  return (
    <Link href={row.href} className="home-branch-repo home-branch-repo--link">
      {name}
    </Link>
  );
}

/** Repository by dev / uat / main: the newest run on each, and any failure streak. */
export function BranchHealthBlock({
  data,
  state,
  reduced,
  order,
}: Readonly<{ data: PersonaDashboard; state: HomeBlockState; reduced: boolean | null; order: number }>) {
  const rows = data.branchHealth;
  return (
    <HomeBlock id="branch-health" kicker="BRANCH HEALTH" title="dev, uat and main" state={state} reduced={reduced} order={order}>
      {rows.length ? (
        <table className="home-branch-table">
          <thead>
            <tr>
              <th scope="col">Repository</th>
              {HEALTH_BRANCHES.map((branch) => (
                <th scope="col" key={branch}>
                  {branch}
                </th>
              ))}
              <th scope="col">Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.repoFullName}>
                <th scope="row">
                  <RepoCell row={row} />
                </th>
                {HEALTH_BRANCHES.map((branch) => (
                  <td key={branch}>
                    <StatusDot
                      tone={RUN_TONE_DOT[row.cells[branch]]}
                      label={`${branch}: ${RUN_TONE_LABEL[row.cells[branch]]}`}
                    />
                  </td>
                ))}
                <td>{row.failureStreak > 0 ? <span className="home-streak">{row.failureStreak} failing</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyLine>No runs yet. Each repository&apos;s dev, uat and main show up here.</EmptyLine>
      )}
    </HomeBlock>
  );
}
