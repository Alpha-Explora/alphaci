"use client";

import { motion } from "framer-motion";
import { Fragment, type ReactNode } from "react";

import { homeBlockState, homeMetricsLoading } from "../../model/home-layout-rules";
import {
  homeEmptyStateFor,
  isPersonaHomeEmpty,
  WAITING_FOR_FIRST_PROJECT,
} from "../../model/home-persona-rules";
import type {
  HomeBlockId,
  HomeLayout,
  HomeSectionStates,
  PersonaDashboard,
} from "../../model/home-persona-types";
import type { ProvisionedProject, RunGroup } from "../../model/home-types";
import { KeyboardShortcuts } from "./dashboard-chrome";
import { myWorkBlock, returnedByQaBlock, scopedRunsBlock } from "./developer-blocks";
import { GetStartedJourney } from "./get-started-journey";
import { sectionVariants } from "./motion";
import {
  BranchHealthBlock,
  PersonaMetricsRail,
  RunsBlock,
  type BlockContext,
} from "./persona-blocks";
import { needsAttentionBlock, readyForProductionBlock } from "./product-owner-blocks";
import {
  defectsBlock,
  retestBlock,
  uatAutomationBlock,
  verificationBlock,
} from "./qa-blocks";
import { QualityCard, TeamProjectsList } from "./workspace-overview";

/* Every block a layout can name, rendered from one context. */
const BLOCKS: Readonly<Record<HomeBlockId, (ctx: BlockContext) => ReactNode>> = {
  "returned-by-qa": returnedByQaBlock,
  "scoped-runs": scopedRunsBlock,
  "my-work": myWorkBlock,
  quality: (ctx) => (
    <QualityCard runStats={ctx.data.runStats} loading={homeBlockState("quality", ctx.states).loading} />
  ),
  "projects-in-verification": verificationBlock,
  "uat-automation": uatAutomationBlock,
  "ready-for-retest": retestBlock,
  defects: defectsBlock,
  "ready-for-production": readyForProductionBlock,
  "branch-health": (ctx) => (
    <BranchHealthBlock
      data={ctx.data}
      state={homeBlockState("branch-health", ctx.states)}
      reduced={ctx.reduced}
      order={ctx.order}
    />
  ),
  "needs-attention": needsAttentionBlock,
  "team-runs": (ctx) => (
    <RunsBlock
      id="team-runs"
      kicker="PIPELINE ACTIVITY"
      title="Latest runs"
      runs={ctx.data.runs}
      running={ctx.data.runStats.running}
      emptyText="No runs yet."
      state={homeBlockState("team-runs", ctx.states)}
      reduced={ctx.reduced}
      order={ctx.order}
      projectIds={ctx.data.runProjectIds}
    />
  ),
  "team-projects": (ctx) => (
    <TeamProjectsList
      group={null}
      projects={ctx.projects}
      loading={homeBlockState("team-projects", ctx.states).loading}
    />
  ),
};

/* The first side block fills the rail and scrolls; the second sits under a hairline. */
const SIDE_SLOT_CLASSES = ["side-rail-block--grow", "side-rail-block--divided"];

/** A Developer's or QA member's empty team: nothing to do until a Project exists. */
function WaitingForFirstProject({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.section
      className="home-waiting"
      aria-labelledby="home-waiting-title"
      custom={2}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <span className={`home-waiting-pulse${reduced ? " home-waiting-pulse--still" : ""}`} aria-hidden="true" />
      <div className="home-waiting-copy">
        <p className="dashboard-section-kicker">NO PROJECTS YET</p>
        <h2 id="home-waiting-title">{WAITING_FOR_FIRST_PROJECT}</h2>
        <p>Once it exists, its repositories, runs and QA progress show up here.</p>
      </div>
    </motion.section>
  );
}

function EmptyHome({
  layout,
  projects,
  runs,
  historyCount,
  reduced,
}: Readonly<{
  layout: HomeLayout;
  projects: ProvisionedProject[];
  runs: RunGroup[];
  historyCount: number;
  reduced: boolean | null;
}>) {
  return (
    <div className="dashboard-flow dashboard-flow--empty">
      {homeEmptyStateFor(layout.persona) === "journey" ? (
        <GetStartedJourney projects={projects} runs={runs} historyCount={historyCount} reduced={reduced} />
      ) : (
        <WaitingForFirstProject reduced={reduced} />
      )}
    </div>
  );
}

/**
 * A role's Home: five metrics, two main blocks, two side blocks and the
 * role's shortcuts, all from one derived dashboard. Fits one screen at
 * 1024x720 and up; every list scrolls inside its block.
 */
export function PersonaOverview({
  layout,
  data,
  states,
  projects,
  runs,
  historyCount,
  reduced,
}: Readonly<{
  layout: HomeLayout;
  data: PersonaDashboard;
  states: HomeSectionStates;
  projects: ProvisionedProject[];
  /** The team's runs, for the get-started journey. */
  runs: RunGroup[];
  historyCount: number;
  reduced: boolean | null;
}>) {
  const empty = isPersonaHomeEmpty({
    states,
    projectCount: projects.length,
    teamProjectCount: data.scope.projectIds.length,
  });
  if (empty) {
    return <EmptyHome layout={layout} projects={projects} runs={runs} historyCount={historyCount} reduced={reduced} />;
  }

  const base = { data, states, reduced, projects };
  return (
    <div className="dashboard-flow">
      <PersonaMetricsRail metrics={data.metrics} loading={homeMetricsLoading(states)} reduced={reduced} />
      <div className="dashboard-main-grid">
        <div className="home-main-col">
          {layout.main.map((id, index) => (
            <Fragment key={id}>{BLOCKS[id]({ ...base, order: 2 + index, slotClass: "" })}</Fragment>
          ))}
        </div>
        <motion.aside
          className="dashboard-side-col"
          custom={4}
          variants={sectionVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          {layout.side.map((id, index) => (
            <Fragment key={id}>{BLOCKS[id]({ ...base, order: 4, slotClass: SIDE_SLOT_CLASSES[index] ?? "" })}</Fragment>
          ))}
        </motion.aside>
      </div>
      <KeyboardShortcuts reduced={reduced} shortcuts={layout.shortcuts} />
    </div>
  );
}
