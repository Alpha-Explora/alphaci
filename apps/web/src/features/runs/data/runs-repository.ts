import { getRuns } from "@/features/runs/data/runs-api";

import type { RunGroup } from "../model/runs-types";

/* The only place in this domain that performs I/O. View-models call this;
 * views never do.
 *
 * It wraps lib/api/runs.ts rather than calling request() directly because
 * app/home/page.tsx still imports that module. When home migrates, the endpoint
 * moves in here and lib/api/runs.ts is deleted — one definition throughout,
 * never two.
 *
 * NEXT_PUBLIC_USE_MOCK is read here and nowhere else. The route used to own
 * this decision, which meant the page knew how its own data was sourced; a view
 * and its view-model should not be able to tell. */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/** Matches the skeleton timing the mock path always had. */
const MOCK_LATENCY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const runsRepository = {
  /**
   * Pipeline runs, optionally narrowed to one repository.
   *
   * Callers cannot tell whether this resolved from the API or the fixture, and
   * must not care.
   */
  async list(repoFullName?: string): Promise<RunGroup[]> {
    if (USE_MOCK) {
      await sleep(MOCK_LATENCY_MS);
      const { MOCK_RUNS } = await import("./runs-mock");
      return repoFullName
        ? MOCK_RUNS.runs.filter((run) => run.repoFullName === repoFullName)
        : MOCK_RUNS.runs;
    }

    const res = await getRuns(repoFullName);
    return res.runs;
  },
};
