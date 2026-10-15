import { request } from "@/shared/api/request";

import { normalizeIterationHistory } from "../model/iteration-history-rules";
import { normalizeCurrentIteration, normalizeMergeAll } from "../model/iteration-rules";
import { normalizeStartedIteration } from "../model/iteration-start-rules";
import type {
  CurrentIteration,
  HistoryIteration,
  MergeAllResult,
  StartedIteration,
  StartIterationInput,
} from "../model/iteration-types";

/* The only place in the checklists domain that talks to the Project
 * iteration endpoints (Iterations phase 2). Its own module, so the screens
 * that read an iteration never change what older tests mock for runs,
 * requirements or promotion. Replies are normalised here.
 *
 * Both routes are newer than the screens that use them: a 404 means "this
 * backend has no iterations", and every caller then renders as before. */

const enc = encodeURIComponent;

function projectPath(deliveryProjectId: string): string {
  return `/delivery-projects/${enc(deliveryProjectId)}`;
}

export const iterationsRepository = {
  /**
   * The Project's active iteration (or the last delivered one), with each
   * covered repository's delivery state. Null when the reply names no
   * iteration: the caller shows nothing iteration-related.
   */
  async current(deliveryProjectId: string): Promise<CurrentIteration | null> {
    return normalizeCurrentIteration(await request<unknown>(`${projectPath(deliveryProjectId)}/iterations/current`));
  },

  /** Every iteration of the Project, newest first (the History tab). */
  async list(deliveryProjectId: string): Promise<HistoryIteration[]> {
    return normalizeIterationHistory(await request<unknown>(`${projectPath(deliveryProjectId)}/iterations`));
  },

  /**
   * Merge uat into main in every covered repository not in main yet (lead /
   * admin). No body: the server re-checks the gate and picks the
   * repositories, so a stale page can never merge what QA did not approve.
   */
  async mergeAll(deliveryProjectId: string): Promise<MergeAllResult> {
    return normalizeMergeAll(
      await request<unknown>(`${projectPath(deliveryProjectId)}/promotion/merge-all`, { method: "POST" }),
    );
  },

  /**
   * Start the Project's next iteration (lead / admin), with an empty
   * checklist: nothing is carried over. The server numbers it and refuses a
   * second start (409 ITERATION_ACTIVE).
   */
  async start(deliveryProjectId: string, input: StartIterationInput): Promise<StartedIteration> {
    return normalizeStartedIteration(
      await request<unknown>(`${projectPath(deliveryProjectId)}/iterations`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
};
