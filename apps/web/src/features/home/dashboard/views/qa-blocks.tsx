"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  countLabel,
  defectSegments,
  runStatusBadge,
  segmentSummary,
  segmentTotal,
  testsLabel,
  verificationSegments,
  verifyStatusLabel,
  verifyTone,
} from "../../model/home-label-rules";
import { homeBlockState } from "../../model/home-layout-rules";
import type {
  RetestRow,
  UatAutomationRow,
  VerificationRow,
} from "../../model/home-persona-types";
import { shortRepoName, timeAgo } from "../../model/home-rules";
import {
  EmptyLine,
  HomeBlock,
  HomeRow,
  HomeRowList,
  HomeSideBlock,
  SegmentBar,
  StatusDot,
  type BlockContext,
} from "./persona-blocks";

/* ── QA Team: "What do I verify next?" ──────────────────────────────────── */

export const NEEDS_NEWER_BACKEND = "Needs a newer backend.";

function VerificationLink({ row, reduced }: Readonly<{ row: VerificationRow; reduced: boolean | null }>) {
  const badge = runStatusBadge(row.status, row.verdict);
  const segments = verificationSegments(row.counts);
  const summary = segmentSummary(segments, "No items verified yet");
  return (
    <Link href={row.href} className="home-verify-row">
      <span className="home-verify-head">
        <strong>{row.name}</strong>
        <span className={`team-status-badge team-status-badge--${badge.tone}`}>{badge.label}</span>
      </span>
      <SegmentBar
        segments={segments.map((segment) => ({ key: segment.key, value: segment.value, tone: segment.key }))}
        label={summary}
        reduced={reduced}
      />
      <small className="home-verify-legend">{summary}</small>
    </Link>
  );
}

/** Every Project with a run, open ones first; each opens QA Studio on its frontend. */
export function verificationBlock(ctx: BlockContext): ReactNode {
  const { data, reduced } = ctx;
  return (
    <HomeBlock
      id="projects-in-verification"
      kicker="PROJECTS IN VERIFICATION"
      title={data.scope.mode === "mine" ? "My Projects" : "The team's Projects"}
      note={data.fallbackLine}
      state={homeBlockState("projects-in-verification", ctx.states)}
      reduced={reduced}
      order={ctx.order}
    >
      {data.verification.length ? (
        <HomeRowList label="Projects with a QA run" reduced={reduced}>
          {data.verification.map((row) => (
            <HomeRow key={row.deliveryProjectId} reduced={reduced}>
              <VerificationLink row={row} reduced={reduced} />
            </HomeRow>
          ))}
        </HomeRowList>
      ) : (
        <EmptyLine>No Project has a QA run yet.</EmptyLine>
      )}
    </HomeBlock>
  );
}

function UatLink({ row }: Readonly<{ row: UatAutomationRow }>) {
  const tests = testsLabel(row.tests);
  const detail = [verifyStatusLabel(row.verify), tests, timeAgo(row.startedAt)].filter(Boolean).join(" · ");
  return (
    <Link href={row.href} className="team-project-row">
      <StatusDot tone={verifyTone(row.verify)} />
      <span className="team-project-copy">
        <strong>{shortRepoName(row.repoFullName)}</strong>
        <small>{detail}</small>
      </span>
      <span className="dashboard-row-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

/** The newest uat run of each repository, with what its verify stage found. */
export function uatAutomationBlock(ctx: BlockContext): ReactNode {
  const { data, reduced } = ctx;
  return (
    <HomeBlock
      id="uat-automation"
      kicker="UAT AUTOMATION"
      title="Latest uat run per repository"
      state={homeBlockState("uat-automation", ctx.states)}
      reduced={reduced}
      order={ctx.order}
    >
      {data.uatAutomation.length ? (
        <HomeRowList label="Latest uat run per repository" reduced={reduced}>
          {data.uatAutomation.map((row) => (
            <HomeRow key={row.repoFullName} reduced={reduced}>
              <UatLink row={row} />
            </HomeRow>
          ))}
        </HomeRowList>
      ) : (
        <EmptyLine>No uat runs yet.</EmptyLine>
      )}
    </HomeBlock>
  );
}

function RetestList({ rows, reduced }: Readonly<{ rows: ReadonlyArray<RetestRow>; reduced: boolean | null }>) {
  if (!rows.length) return <EmptyLine>Nothing is waiting for a re-test.</EmptyLine>;
  return (
    <HomeRowList label="Projects with items ready for a re-test" reduced={reduced}>
      {rows.map((row) => (
        <HomeRow key={row.deliveryProjectId} reduced={reduced}>
          <Link href={row.href} className="team-project-row">
            <StatusDot tone="ok" />
            <span className="team-project-copy">
              <strong>{row.name}</strong>
              <small>{countLabel(row.ready, "item ready", "items ready")}</small>
            </span>
            <span className="dashboard-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </HomeRow>
      ))}
    </HomeRowList>
  );
}

/** Items a Developer marked done that QA has not verified again yet. */
export function retestBlock(ctx: BlockContext): ReactNode {
  const rows = ctx.data.retest;
  return (
    <HomeSideBlock
      id="ready-for-retest"
      kicker="READY FOR RE-TEST"
      state={homeBlockState("ready-for-retest", ctx.states)}
      slotClass={ctx.slotClass}
    >
      {rows ? <RetestList rows={rows} reduced={ctx.reduced} /> : <EmptyLine>{NEEDS_NEWER_BACKEND}</EmptyLine>}
    </HomeSideBlock>
  );
}

function DefectBreakdown({ ctx }: Readonly<{ ctx: BlockContext }>) {
  const defects = ctx.data.defects;
  if (!defects) return <EmptyLine>{NEEDS_NEWER_BACKEND}</EmptyLine>;
  const segments = defectSegments(defects);
  if (segmentTotal(segments) === 0) return <EmptyLine>No open defects.</EmptyLine>;
  const summary = segmentSummary(segments, "No open defects");
  return (
    <div className="home-defects">
      <SegmentBar
        segments={segments.map((segment) => ({ key: segment.key, value: segment.value, tone: segment.key }))}
        label={`Open defects: ${summary}`}
        reduced={ctx.reduced}
      />
      <ul className="home-defect-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className={`home-legend-swatch home-seg-part--${segment.key}`} aria-hidden="true" />
            <span className="home-defect-label">{segment.label}</span>
            <span className="home-defect-count">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Open defects across the Projects in scope, by severity. */
export function defectsBlock(ctx: BlockContext): ReactNode {
  return (
    <HomeSideBlock
      id="defects"
      kicker="DEFECTS BY SEVERITY"
      state={homeBlockState("defects", ctx.states)}
      slotClass={ctx.slotClass}
    >
      <DefectBreakdown ctx={ctx} />
    </HomeSideBlock>
  );
}
