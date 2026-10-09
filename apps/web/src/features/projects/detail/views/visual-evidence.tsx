"use client";

import "./visual-evidence.css";

import {
  EVIDENCE_ERROR_TEXT,
  IMAGE_CAPTIONS,
  NO_EVIDENCE_TEXT,
  STATUS_WORDS,
} from "../model/visual-evidence-rules";
import type { VisualSnapshot } from "../model/visual-check-types";
import { useVisualEvidenceViewModel } from "../view-models/use-visual-evidence-view-model";

const KINDS = ["baselineUrl", "actualUrl", "diffUrl"] as const;

function SnapshotRow({ snapshot, onImage }: Readonly<{ snapshot: VisualSnapshot; onImage: () => void }>) {
  return (
    <li className="vis-ev__snapshot">
      <p className="vis-ev__name">
        <code>{snapshot.name}</code>
        <span className={`vis-ev__status vis-ev__status--${snapshot.status}`}>{STATUS_WORDS[snapshot.status]}</span>
      </p>
      <div className="vis-ev__images">
        {KINDS.map((kind) => {
          const url = snapshot[kind];
          if (!url) return null;
          return (
            <figure key={kind} className="vis-ev__figure">
              {/* A plain <img>: the bytes come with the session cookie, and next/image would proxy them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${IMAGE_CAPTIONS[kind]}: ${snapshot.name}`} onLoad={onImage} onError={onImage} />
              <figcaption>{IMAGE_CAPTIONS[kind]}</figcaption>
            </figure>
          );
        })}
      </div>
    </li>
  );
}

/**
 * One repository's screenshots for a printed report: each changed or new one
 * beside its reference and difference, the matching ones as a list of names.
 * Read once; `onSettled` says when the section has everything it will have, so
 * the page can wait for the images before it opens the print dialog.
 */
export function VisualEvidence({
  projectId,
  headSha,
  onSettled,
}: Readonly<{
  projectId: string;
  /** The uat head the report's run captured, to say whether these screenshots are on it. */
  headSha: string | null;
  onSettled?: () => void;
}>) {
  const view = useVisualEvidenceViewModel({ projectId, headSha, onSettled });
  if (view.status === "loading") return <p className="vis-ev__note">Reading the screenshots…</p>;
  if (view.status === "error") return <p className="vis-ev__note vis-ev__note--error">{EVIDENCE_ERROR_TEXT}</p>;
  const { evidence } = view;
  if (!evidence) return <p className="vis-ev__note">{NO_EVIDENCE_TEXT}</p>;
  return (
    <div className="vis-ev">
      <p className="vis-ev__header">{evidence.header}</p>
      <p className="vis-ev__note">{evidence.provenance}</p>
      {evidence.shown.length > 0 ? (
        <ul className="vis-ev__list">
          {evidence.shown.map((snapshot) => (
            <SnapshotRow key={snapshot.name} snapshot={snapshot} onImage={view.imageSettled} />
          ))}
        </ul>
      ) : null}
      {evidence.matched.length > 0 ? (
        <p className="vis-ev__matched">
          <strong>Unchanged:</strong> {evidence.matched.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
