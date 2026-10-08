"use client";

import { useEffect, useRef, useState } from "react";

import { playwrightLiveRepository } from "../../data/playwright-live-repository";
import {
  applyLiveReads,
  liveConfirmationMode,
  liveKeepPolling,
  LIVE_DISPATCH_GRACE_MS,
  LIVE_POLL_INTERVAL_MS,
  LIVE_POLL_MAX_MS,
  type LiveConfirmationMode,
  type LiveRead,
  type LiveRound,
  type LiveRuns,
} from "../../model/playwright-live-rules";
import { errorStatus } from "../../model/wire-readers";
import { usePageVisible } from "./use-page-visible";

export interface LiveRepository {
  projectId: string;
  /** "storefront-web", for the milestones a screen reader hears. */
  name: string;
}

export interface PlaywrightLiveViewModel {
  /** Null until the first answer; false on a backend without the route (404): the tab is as before. */
  supported: boolean | null;
  /** Each repository's latest Playwright run once read (null: none yet); absent until read. */
  runs: LiveRuns;
  /** Run Playwright was pressed and its run has not shown up yet. */
  awaiting: boolean;
  /** What Run Playwright's confirmation does now that progress is live. */
  confirmation: LiveConfirmationMode;
  /** The latest milestones ("Playwright started…", a failure, "…passed"), for a polite live region. */
  announcement: string;
}

const NO_RUNS: LiveRuns = {};

function readLive(projectId: string, branch: string): Promise<LiveRead> {
  return playwrightLiveRepository
    .getPlaywrightLive(projectId, branch)
    .then((run): LiveRead => ({ kind: "run", run }))
    .catch((cause: unknown): LiveRead => (errorStatus(cause) === 404 ? { kind: "missing" } : { kind: "error" }));
}

/** The runs read for these repositories; another set (a project change) starts empty. */
function runsFor(view: { key: string; runs: LiveRuns }, key: string): LiveRuns {
  return view.key === key ? view.runs : NO_RUNS;
}

/**
 * Live, test-by-test progress of Playwright in each frontend repository.
 *
 * Reads once when the Playwright tab shows (`enabled`), then every 3 s while
 * a run is queued, starting or running — paused while the browser tab is
 * hidden, resumed with an immediate read. Run Playwright (`startedAt`) reads
 * at once and keeps reading until its run shows up (up to 3 minutes). When a
 * run it watched finishes, `onFinished` re-reads the QA run so the stage
 * cards catch up, and polling stops. A 404 (a backend without the route)
 * stops everything for good and the tab stays as it was. Unmounting, or
 * another set of repositories, cancels; a slow answer after that is dropped.
 */
export function usePlaywrightLiveViewModel(options: {
  repositories: ReadonlyArray<LiveRepository>;
  branch: string;
  /** The Playwright tab is showing. */
  enabled: boolean;
  /** When Run Playwright last started a workflow (epoch ms); null before. */
  startedAt: number | null;
  onFinished: () => void;
}): PlaywrightLiveViewModel {
  const { repositories, enabled, startedAt } = options;
  const key = repositories.map((repository) => repository.projectId).join(",");
  const visible = usePageVisible();
  const [view, setView] = useState<{ key: string; runs: LiveRuns }>({ key, runs: NO_RUNS });
  const [supported, setSupported] = useState<boolean | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** The dispatch whose run has shown up (or whose wait ran out). */
  const [arrivedFor, setArrivedFor] = useState<number | null>(null);
  const latest = useRef({ options, view, supported, arrivedFor });

  useEffect(() => {
    latest.current = { options, view, supported, arrivedFor };
  });

  useEffect(() => {
    if (!enabled || !visible || !key || latest.current.supported === false) return;
    let cancelled = false;
    let timer: number | undefined;
    const pollingSince = Date.now();
    const dispatchedAt = startedAt;

    /** Folds a round in; false when the backend has no live route (stop for good). */
    function apply(round: LiveRound): boolean {
      latest.current.view = { key, runs: round.runs };
      setView(latest.current.view);
      if (round.milestones.length > 0) setAnnouncement(round.milestones.join(" "));
      latest.current.supported = !round.missing;
      setSupported(!round.missing);
      return !round.missing;
    }

    /** Run Playwright's run showed up, or waiting for it ran out. */
    function settleArrival(round: LiveRound, now: number) {
      if (!arrivalSettled(dispatchedAt, latest.current.arrivedFor, round.arrived, now)) return;
      latest.current.arrivedFor = dispatchedAt;
      setArrivedFor(dispatchedAt);
    }

    async function tick() {
      const { options: current, view: known } = latest.current;
      const reads = await Promise.all(current.repositories.map((repository) => readLive(repository.projectId, current.branch)));
      if (cancelled) return;
      const round = applyLiveReads(runsFor(known, key), current.repositories, reads);
      if (!apply(round)) return;
      if (round.finished) current.onFinished();
      const now = Date.now();
      settleArrival(round, now);
      const keep = liveKeepPolling({
        runs: Object.values(round.runs),
        supported: true,
        awaitingUntil: awaitingDeadline(dispatchedAt, latest.current.arrivedFor),
        now,
      });
      if (keep && now - pollingSince < LIVE_POLL_MAX_MS) timer = window.setTimeout(() => void tick(), LIVE_POLL_INTERVAL_MS);
    }

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // The repositories and branch are read through `latest`; `key` stands for them.
  }, [enabled, visible, key, startedAt]);

  const runs = runsFor(view, key);
  const awaiting = startedAt !== null && arrivedFor !== startedAt && supported !== false;
  return {
    supported,
    runs,
    awaiting,
    confirmation: liveConfirmationMode({ supported, awaiting, anyRun: Object.values(runs).some(Boolean) }),
    announcement,
  };
}

/** Until when Run Playwright's run is waited for; null when nothing is awaited. */
function awaitingDeadline(dispatchedAt: number | null, arrivedFor: number | null): number | null {
  return dispatchedAt !== null && arrivedFor !== dispatchedAt ? dispatchedAt + LIVE_DISPATCH_GRACE_MS : null;
}

/** Whether the wait for Run Playwright's run is over: it showed up, or the grace ran out. */
function arrivalSettled(dispatchedAt: number | null, arrivedFor: number | null, arrived: boolean, now: number): boolean {
  const deadline = awaitingDeadline(dispatchedAt, arrivedFor);
  if (deadline === null) return false;
  return arrived || now >= deadline;
}
