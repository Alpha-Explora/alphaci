"use client";

import { useState } from "react";

import {
  canFramePreview,
  previewFrameSandbox,
  previewProviderLabel,
  previewStatusLabel,
  previewStatusTone,
  previewUnavailableReason,
  shortCommitSha,
} from "../../model/projects-rules";
import type { ProjectBranchPreview } from "../../model/projects-types";
import { useDashboardOrigin } from "../view-models/use-dashboard-origin";

/**
 * The framed preview.
 *
 * Only mounted once the backend has confirmed the site allows framing, so this
 * component never has to guess. The sandbox comes from previewFrameSandbox,
 * which grants `allow-same-origin` only to a page on another origin than the
 * dashboard's, so the frame waits until that origin is known.
 */
function PreviewViewport({
  preview,
}: Readonly<{ preview: ProjectBranchPreview }>) {
  const [loaded, setLoaded] = useState(false);
  const origin = useDashboardOrigin();
  const url = preview.previewUrl ?? "";

  return (
    <div className="branch-preview__viewport">
      {!loaded ? (
        <p className="branch-preview__viewport-status">Loading preview…</p>
      ) : null}
      {origin ? (
        <iframe
          className="branch-preview__frame"
          src={url}
          title={`Preview of branch ${preview.branch}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          sandbox={previewFrameSandbox(url, origin)}
          referrerPolicy="no-referrer"
        />
      ) : null}
    </div>
  );
}

/**
 * The actions under a preview, extracted so the card itself stays within the
 * complexity budget: the address of an environment with nothing deployed to it
 * is rendered differently from a live one, and that branch belongs beside the
 * other action rules rather than inside the card's layout.
 */
function PreviewActions({
  preview,
}: Readonly<{ preview: ProjectBranchPreview }>) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    if (!preview.previewUrl) return;
    try {
      await navigator.clipboard.writeText(preview.previewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard permission can be refused; the URL is on screen and the
      // Open action still works, so there is nothing to escalate.
    }
  }

  return (
    <footer className="branch-preview__actions">
      {preview.previewUrl ? (
        <>
          {/*
           * The address of an environment with nothing deployed to it is
           * shown, not linked: it resolves to nothing until the first
           * release, and a link that 404s reads as a broken deployment
           * rather than an empty one. Copy still helps — it is the address
           * to configure things against.
           */}
          {preview.status === "not_deployed" ? (
            <code className="branch-preview__pending-url">
              {preview.previewUrl}
            </code>
          ) : (
            <a
              className="ghost-button target-action-btn"
              href={preview.previewUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open site
            </a>
          )}
          <button
            className="ghost-button target-action-btn"
            type="button"
            onClick={() => void copyUrl()}
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
        </>
      ) : null}
      {preview.status === "not_deployed" && preview.inspectorUrl ? (
        <a
          className="ghost-button target-action-btn"
          href={preview.inspectorUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Provider dashboard
        </a>
      ) : null}
    </footer>
  );
}

export function BranchPreviewCard({
  preview,
}: Readonly<{ preview: ProjectBranchPreview }>) {
  const sha = shortCommitSha(preview.commitSha);

  return (
    <article className="branch-preview">
      <header className="branch-preview__header">
        <div>
          <h4 className="branch-preview__branch">
            <span className="branch-preview__branch-name">
              {preview.branch}
            </span>
            {preview.isProduction ? (
              <span className="branch-preview__badge">Production</span>
            ) : null}
          </h4>
          <p className="branch-preview__meta">
            {previewProviderLabel(preview.provider)} · {preview.targetName}
            {preview.pullRequestNumber !== null
              ? ` · PR #${preview.pullRequestNumber}`
              : ""}
            {sha ? ` · ${sha}` : ""}
          </p>
          {preview.commitMessage ? (
            <p className="branch-preview__commit">{preview.commitMessage}</p>
          ) : null}
        </div>
        <span
          className={`branch-preview__status branch-preview__status--${previewStatusTone(
            preview.status,
          )}`}
        >
          {previewStatusLabel(preview.status)}
        </span>
      </header>

      {canFramePreview(preview) ? (
        <PreviewViewport preview={preview} />
      ) : (
        <p className="branch-preview__placeholder">
          {previewUnavailableReason(preview)}
        </p>
      )}

      <PreviewActions preview={preview} />
    </article>
  );
}
