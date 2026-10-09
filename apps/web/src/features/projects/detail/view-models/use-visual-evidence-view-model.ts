"use client";

import { useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/shared/api/request";

import { getProjectVisualChecks } from "../data/project-visual-api";
import { EVIDENCE_IMAGE_WAIT_MS, visualEvidenceOf, type VisualEvidence } from "../model/visual-evidence-rules";
import { withImageUrls } from "../model/visual-check-rules";

export type VisualEvidenceStatus = "loading" | "ready" | "error";

export interface VisualEvidenceViewModel {
  status: VisualEvidenceStatus;
  /** Null when the repository's latest run reported no screenshots. */
  evidence: VisualEvidence | null;
  /** One image finished, loaded or not: a failed image must not hold the print. */
  imageSettled: () => void;
}

/**
 * One repository's visual evidence for a printed report, read once from its
 * latest uat run. `onSettled` fires exactly once, when the section has
 * everything it is going to have: nothing to draw, a read that failed, or
 * every image loaded (or failed). A wait cap means an image that never answers
 * cannot hold the print forever.
 */
export function useVisualEvidenceViewModel(options: {
  projectId: string;
  headSha: string | null;
  onSettled?: () => void;
}): VisualEvidenceViewModel {
  const { projectId, headSha, onSettled } = options;
  const [state, setState] = useState<{ status: VisualEvidenceStatus; evidence: VisualEvidence | null }>({
    status: "loading",
    evidence: null,
  });
  const settledOnce = useRef(false);
  const remaining = useRef(0);
  const notify = useRef(onSettled);

  // Declared before the read, so the latest callback is in place when it answers.
  useEffect(() => {
    notify.current = onSettled;
  });

  function settle() {
    if (settledOnce.current) return;
    settledOnce.current = true;
    notify.current?.();
  }

  useEffect(() => {
    let live = true;
    getProjectVisualChecks(projectId, "uat", null).then(
      (response) => {
        if (!live) return;
        const evidence = visualEvidenceOf(withImageUrls(response, getApiBaseUrl()), headSha);
        remaining.current = evidence?.imageCount ?? 0;
        setState({ status: "ready", evidence });
        if (remaining.current === 0) settle();
      },
      () => {
        if (!live) return;
        setState({ status: "error", evidence: null });
        settle();
      },
    );
    const cap = window.setTimeout(settle, EVIDENCE_IMAGE_WAIT_MS);
    return () => {
      live = false;
      window.clearTimeout(cap);
    };
    // The read is keyed by repository; the callbacks it reaches go through refs.
  }, [projectId, headSha]);

  return {
    ...state,
    imageSettled: () => {
      remaining.current -= 1;
      if (remaining.current <= 0) settle();
    },
  };
}
