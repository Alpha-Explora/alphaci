"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { countLabel } from "../../model/home-label-rules";
import { homeBlockState } from "../../model/home-layout-rules";
import { MY_WORK_EMPTY_LINE } from "../../model/home-persona-rules";
import type {
  MyWorkProject,
  MyWorkRepository,
  ReturnedRow,
} from "../../model/home-persona-types";
import type { TeamQaDefectCounts } from "../../model/home-types";
import {
  EmptyLine,
  HomeBlock,
  HomeRow,
  HomeRowList,
  HomeSideBlock,
  InlineLink,
  RUN_TONE_DOT,
  RUN_TONE_LABEL,
  RunsBlock,
  StatusDot,
  type BlockContext,
} from "./persona-blocks";

/* ── Developer: "What do I fix next?" ───────────────────────────────────── */

const SEVERITIES = ["blocker", "major", "minor"] as const;

function DefectChips({ defects }: Readonly<{ defects: TeamQaDefectCounts | null }>) {
  if (!defects) return null;
  const shown = SEVERITIES.filter((severity) => defects[severity] > 0);
  if (!shown.length) return null;
  return (
    <span className="home-sev-chips">
      {shown.map((severity) => (
        <span key={severity} className={`home-sev home-sev--${severity}`}>
          {defects[severity]} {severity}
        </span>
      ))}
    </span>
  );
}

function ReturnedLink({ row }: Readonly<{ row: ReturnedRow }>) {
  return (
    <Link href={row.href} className="team-project-row">
      <StatusDot tone="danger" />
      <span className="team-project-copy">
        <strong>{row.name}</strong>
        <small>{countLabel(row.returned, "item returned to development", "items returned to development")}</small>
      </span>
      <DefectChips defects={row.defects} />
      <span className="dashboard-row-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

/** Items QA sent back, per Project; each opens that Project's "My QA items". */
export function returnedByQaBlock(ctx: BlockContext): ReactNode {
  const { data, reduced } = ctx;
  return (
    <HomeBlock
      id="returned-by-qa"
      kicker="RETURNED BY QA"
      title={data.scope.mode === "mine" ? "In my Projects" : "Across the team's Projects"}
      state={homeBlockState("returned-by-qa", ctx.states)}
      reduced={reduced}
      order={ctx.order}
    >
      {data.returned.length ? (
        <HomeRowList label="Projects with items returned by QA" reduced={reduced}>
          {data.returned.map((row) => (
            <HomeRow key={row.deliveryProjectId} reduced={reduced}>
              <ReturnedLink row={row} />
            </HomeRow>
          ))}
        </HomeRowList>
      ) : (
        <EmptyLine>Nothing returned by QA.</EmptyLine>
      )}
    </HomeBlock>
  );
}

/** The runs of the repositories in scope, failures first. */
export function scopedRunsBlock(ctx: BlockContext): ReactNode {
  const mine = ctx.data.scope.mode === "mine";
  return (
    <RunsBlock
      id="scoped-runs"
      kicker={mine ? "MY PIPELINE RUNS" : "TEAM PIPELINE RUNS"}
      title="Failures first"
      runs={ctx.data.runs}
      running={ctx.data.runStats.running}
      emptyText={mine ? "No runs in your Projects yet." : "No runs yet."}
      state={homeBlockState("scoped-runs", ctx.states)}
      reduced={ctx.reduced}
      order={ctx.order}
      projectIds={ctx.data.runProjectIds}
    />
  );
}

function RepositoryLine({ repository }: Readonly<{ repository: MyWorkRepository }>) {
  const content = (
    <>
      <StatusDot tone={RUN_TONE_DOT[repository.tone]} label={`Latest run ${RUN_TONE_LABEL[repository.tone]}`} />
      <span className="home-work-repo-name">{repository.name}</span>
      {repository.branch ? <span className="run-card-branch-pill">{repository.branch}</span> : null}
    </>
  );
  if (!repository.href) return <span className="home-work-repo">{content}</span>;
  return (
    <Link href={repository.href} className="home-work-repo home-work-repo--link">
      {content}
    </Link>
  );
}

function WorkProject({ project }: Readonly<{ project: MyWorkProject }>) {
  return (
    <li className="home-work-project">
      <Link href={project.href} className="home-work-project-link">
        <strong>{project.name}</strong>
        <span className="dashboard-row-arrow" aria-hidden="true">
          →
        </span>
      </Link>
      {project.repositories.length ? (
        <ul className="home-work-repos" aria-label={`Repositories in ${project.name}`}>
          {project.repositories.map((repository) => (
            <li key={repository.repositoryId}>
              <RepositoryLine repository={repository} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-work-empty">No repositories yet.</p>
      )}
    </li>
  );
}

/**
 * My Projects, each with its repositories and their newest run. With no
 * Project of their own, a Developer sees the team's, and is told why.
 */
export function myWorkBlock(ctx: BlockContext): ReactNode {
  const { data } = ctx;
  const href = data.addRepositoryHref;
  return (
    <HomeSideBlock
      id="my-work"
      kicker={data.scope.mode === "mine" ? "MY WORK" : "TEAM PROJECTS"}
      action={href ? <InlineLink href={href}>Add repository</InlineLink> : null}
      note={data.fallbackLine}
      state={homeBlockState("my-work", ctx.states)}
      slotClass={ctx.slotClass}
    >
      {data.myWork.length ? (
        <ul className="home-work-list">
          {data.myWork.map((project) => (
            <WorkProject key={project.deliveryProjectId} project={project} />
          ))}
        </ul>
      ) : (
        <EmptyLine>{MY_WORK_EMPTY_LINE}</EmptyLine>
      )}
    </HomeSideBlock>
  );
}
