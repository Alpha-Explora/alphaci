"use client";

import { useEffect, useRef, useState } from "react";

import { getProjectVisualChecks } from "../data/project-visual-api";
import type { VisualBranch, VisualChecksResponse } from "../model/visual-check-types";

export interface StudioVisualSummaryViewModel {
  /** "error" leaves the line out: it is a pointer to Pipeline runs, not a report. */
  status: "loading" | "ready" | "error";
  checks: VisualChecksResponse | null;
}

/**
 * The visual checks a studio's Playwright tab summarises in one line: the
 * branch's latest screenshots for one repository. Read once when the tab
 * first shows that repository (nothing here calls GitHub) and never polled —
 * screenshots change once per deploy. Reviewing and approving them stays on
 * the Pipeline runs tab's Verify stage.
 */
export function useStudioVisualSummaryViewModel(options: {
  projectId: string;
  branch: VisualBranch;
}): StudioVisualSummaryViewModel {
  const { projectId, branch } = options;
  const [result, setResult] = useState<{ key: string; value: StudioVisualSummaryViewModel } | null>(null);
  const ticket = useRef(0);
  const key = `${projectId}|${branch}`;

  useEffect(() => {
    const mine = ++ticket.current;
    getProjectVisualChecks(projectId, branch, null)
      .then((checks) => {
        if (mine === ticket.current) setResult({ key, value: { status: "ready", checks } });
      })
      .catch(() => {
        if (mine === ticket.current) setResult({ key, value: { status: "error", checks: null } });
      });
  }, [projectId, branch, key]);

  return result?.key === key ? result.value : { status: "loading", checks: null };
}
