"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  countLabel,
  mergedLabel,
  runStatusBadge,
  signedOffLine,
  verdictBadge,
} from "../../model/home-label-rules";
import { homeBlockState } from "../../model/home-layout-rules";
import type {
  AttentionRow,
  LegacyRunRow,
  OpenRunRow,
  ProductionView,
  ReadyForProductionRow,
} from "../../model/home-persona-types";
import {
  EmptyLine,
  HomeBlock,
  HomeRow,
  HomeRowList,
  HomeSideBlock,
  InlineLink,
  StatusDot,
  type BlockContext,
} from "./persona-blocks";

/* ── Product owner: "What can ship, and what's stuck?" ──────────────────── */

function ReadyLink({ row }: Readonly<{ row: ReadyForProductionRow }>) {
  const badge = verdictBadge(row.verdict);
  return (
    <Link href={row.href} className="team-project-row">
      <StatusDot tone="ok" />
      <span className="team-project-copy">
        <strong>{row.name}</strong>
        <small>
          {signedOffLine(row)} · {mergedLabel(row)}
        </small>
      </span>
      <span className={`team-status-badge team-status-badge--${badge.tone}`}>{badge.label}</span>
      <span className="dashboard-row-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

function openRunDetail(row: OpenRunRow): string {
  const parts = [
    row.failed ? countLabel(row.failed, "failed", "failed") : null,
    row.blocked ? countLabel(row.blocked, "blocked", "blocked") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing failed or blocked so far";
}

function OpenRunLink({ row }: Readonly<{ row: OpenRunRow }>) {
  return (
    <Link href={row.href} className="home-quiet-row">
      <span className="home-quiet-name">{row.name}</span>
      <span className="home-quiet-detail">{openRunDetail(row)}</span>
    </Link>
  );
}

function LegacyRunLink({ row }: Readonly<{ row: LegacyRunRow }>) {
  const badge = runStatusBadge(row.status, null);
  return (
    <Link href={row.href} className="team-project-row">
      <StatusDot tone={badge.tone} />
      <span className="team-project-copy">
        <strong>{row.name}</strong>
        <small>QA run {badge.label.toLowerCase()}</small>
      </span>
      <span className={`team-status-badge team-status-badge--${badge.tone}`}>{badge.label}</span>
    </Link>
  );
}

function ReadyList({ production, reduced }: Readonly<{ production: ProductionView; reduced: boolean | null }>) {
  if (!production.ready.length) return <EmptyLine>Nothing is signed off and waiting to ship.</EmptyLine>;
  return (
    <HomeRowList label="Projects ready for production" reduced={reduced}>
      {production.ready.map((row) => (
        <HomeRow key={row.deliveryProjectId} reduced={reduced}>
          <ReadyLink row={row} />
        </HomeRow>
      ))}
    </HomeRowList>
  );
}

function StillVerifying({ production }: Readonly<{ production: ProductionView }>) {
  if (!production.open.length) return null;
  return (
    <div className="home-quiet-group">
      <p className="home-subhead">Still in verification</p>
      <ul className="home-quiet-list">
        {production.open.map((row) => (
          <li key={row.deliveryProjectId}>
            <OpenRunLink row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegacyList({ production, reduced }: Readonly<{ production: ProductionView; reduced: boolean | null }>) {
  if (!production.legacy.length) return <EmptyLine>No Project has a QA run yet.</EmptyLine>;
  return (
    <HomeRowList label="Projects with a QA run" reduced={reduced}>
      {production.legacy.map((row) => (
        <HomeRow key={row.deliveryProjectId} reduced={reduced}>
          <LegacyRunLink row={row} />
        </HomeRow>
      ))}
    </HomeRowList>
  );
}

function ProductionBody({ production, reduced }: Readonly<{ production: ProductionView; reduced: boolean | null }>) {
  if (production.mode === "legacy") return <LegacyList production={production} reduced={reduced} />;
  return (
    <>
      <ReadyList production={production} reduced={reduced} />
      <StillVerifying production={production} />
    </>
  );
}

/**
 * Signed off (Approved or Conditional) and not merged to main everywhere yet,
 * then, quieter, what QA is still verifying. Each opens PO Studio, where the
 * final checks and the merge happen.
 */
export function readyForProductionBlock(ctx: BlockContext): ReactNode {
  return (
    <HomeBlock
      id="ready-for-production"
      kicker="READY FOR PRODUCTION"
      title="Signed off by QA"
      state={homeBlockState("ready-for-production", ctx.states)}
      reduced={ctx.reduced}
      order={ctx.order}
    >
      <ProductionBody production={ctx.data.production} reduced={ctx.reduced} />
      <p className="home-block-foot">Final checks and the merge to main run in PO Studio.</p>
    </HomeBlock>
  );
}

function AttentionLink({ row }: Readonly<{ row: AttentionRow }>) {
  return (
    <Link href={row.href} className="team-project-row">
      <StatusDot tone="warn" />
      <span className="team-project-copy">
        <strong>{row.name}</strong>
        <small>{row.reasons.join(" · ")}</small>
      </span>
      <span className="dashboard-row-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

/** Projects only a Product owner can unblock: no Features, or no Developers. */
export function needsAttentionBlock(ctx: BlockContext): ReactNode {
  const { data, reduced } = ctx;
  const href = data.createProjectHref;
  return (
    <HomeSideBlock
      id="needs-attention"
      kicker="PROJECTS NEEDING ATTENTION"
      action={href ? <InlineLink href={href}>Create project</InlineLink> : null}
      state={homeBlockState("needs-attention", ctx.states)}
      slotClass={ctx.slotClass}
    >
      {data.needsAttention.length ? (
        <HomeRowList label="Projects needing attention" reduced={reduced}>
          {data.needsAttention.map((row) => (
            <HomeRow key={row.deliveryProjectId} reduced={reduced}>
              <AttentionLink row={row} />
            </HomeRow>
          ))}
        </HomeRowList>
      ) : (
        <EmptyLine>No Project is waiting on you.</EmptyLine>
      )}
    </HomeSideBlock>
  );
}
