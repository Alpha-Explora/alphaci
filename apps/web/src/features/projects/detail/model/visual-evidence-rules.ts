/* Visual evidence for a printed report — which screenshots to draw, and how to
 * word what the reader is looking at. Pure: no React, no fetch.
 *
 * A sign-off record needs the screenshots that changed or are new, side by side
 * with their reference; the ones that matched need no picture, only a count.
 * The screenshots are the branch's LATEST Verify run, which is not necessarily
 * the commit the report covers, so the section says whose they are. */

import { groupSnapshots, visualCounts, visualHeader } from "./visual-check-rules";
import type { VisualChecksResponse, VisualSnapshot } from "./visual-check-types";

const SHA_LENGTH = 7;

/** How long to wait for the images before printing without them. */
export const EVIDENCE_IMAGE_WAIT_MS = 8_000;

export interface VisualEvidence {
  /** "Visual checks · 1 changed · 2 unchanged". */
  header: string;
  /** Changed first, then new: the ones worth looking at. */
  shown: VisualSnapshot[];
  /** Names that matched their reference, listed without a picture. */
  matched: string[];
  /** Whose screenshots these are, and whether they are the report's commit. */
  provenance: string;
  /** How many images the section will ask the browser for. */
  imageCount: number;
}

function imagesOf(snapshot: VisualSnapshot): number {
  return [snapshot.baselineUrl, snapshot.actualUrl, snapshot.diffUrl].filter((url) => url !== null).length;
}

/** Whether the screenshots were taken on the head the report captured. Null when either is unknown. */
export function evidenceMatchesHead(commitSha: string, headSha: string | null): boolean | null {
  if (!headSha || !commitSha) return null;
  const length = Math.min(commitSha.length, headSha.length, SHA_LENGTH);
  return commitSha.slice(0, length) === headSha.slice(0, length);
}

function provenanceOf(response: Extract<VisualChecksResponse, { runId: number }>, headSha: string | null): string {
  const sha = response.commitSha.slice(0, SHA_LENGTH);
  const base = `Latest Verify run on ${response.branch}, commit ${sha}`;
  const same = evidenceMatchesHead(response.commitSha, headSha);
  if (same === false) {
    return `${base}. ${response.branch} has moved since this run started, so these are not the commit the run covers.`;
  }
  return base + ".";
}

/**
 * What the section draws for one repository, or null when its latest run
 * reported no screenshots at all.
 */
export function visualEvidenceOf(response: VisualChecksResponse, headSha: string | null): VisualEvidence | null {
  if (response.runId === null || response.snapshots.length === 0) return null;
  const groups = groupSnapshots(response.snapshots);
  const shown = [...groups.changed, ...groups.added];
  return {
    header: visualHeader(visualCounts(response.snapshots)),
    shown,
    matched: groups.passed.map((snapshot) => snapshot.name),
    provenance: provenanceOf(response, headSha),
    imageCount: shown.reduce((total, snapshot) => total + imagesOf(snapshot), 0),
  };
}

export const NO_EVIDENCE_TEXT = "No screenshots were reported for this repository on uat.";

export const EVIDENCE_ERROR_TEXT = "The screenshots could not be read, so they are not in this report.";

export const STATUS_WORDS: Record<VisualSnapshot["status"], string> = {
  passed: "Matches its reference",
  changed: "Changed",
  new: "New: no reference yet",
};

export const IMAGE_CAPTIONS = { baselineUrl: "Reference", actualUrl: "New", diffUrl: "Difference" } as const;
