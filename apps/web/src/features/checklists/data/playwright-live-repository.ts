import { request } from "@/shared/api/request";

import { normalizePlaywrightLive } from "../model/playwright-live-rules";
import type { PlaywrightLiveRun } from "../model/playwright-live-types";

/* The only place in the checklists domain that reads live Playwright
 * progress. Its own module, so the studio's existing test mocks of the QA run
 * repositories stay whole.
 *
 * A backend without the route answers 404; the ApiError is passed on and the
 * ViewModel falls back to the stage cards. */

export const playwrightLiveRepository = {
  /** The latest Playwright run on `branch` for one repository (its ALPHACI project id); null when there is none. */
  async getPlaywrightLive(projectId: string, branch: string): Promise<PlaywrightLiveRun | null> {
    const search = new URLSearchParams({ branch });
    const raw = await request<unknown>(
      `/projects/${encodeURIComponent(projectId)}/workspace/playwright-live?${search.toString()}`,
    );
    return normalizePlaywrightLive(raw);
  },
};
