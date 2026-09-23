"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  canFramePreview,
  commitUrl,
  createdLabel,
  displayHost,
  previewFrameSandbox,
  previewProviderLabel,
  previewStatusLabel,
  previewStatusTone,
  previewUnavailableReason,
  shortCommitSha,
} from "../../model/projects-rules";
import type { ProjectBranchPreview } from "../../model/projects-types";
import { useDashboardOrigin } from "../view-models/use-dashboard-origin";
import {
  BranchIcon,
  CommitIcon,
  ExternalIcon,
  GithubIcon,
} from "./deployment-icons";

/** The width the framed page lays out at before it is scaled into the card. */
const THUMBNAIL_LAYOUT_WIDTH = 1280;

type CardProps = Readonly<{
  preview: ProjectBranchPreview;
  /** Owner/name on GitHub, for the commit link. */
  repoFullName?: string | null;
}>;

/**
 * Scale that fits a desktop-width page into the thumbnail's column.
 *
 * Measured rather than fixed so the thumbnail fills its column at every
 * breakpoint. jsdom has no ResizeObserver; the initial scale stands in there.
 */
function useThumbnailScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / THUMBNAIL_LAYOUT_WIDTH);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
}

/**
 * The live page, shrunk to a thumbnail.
 *
 * `inert` keeps the framed page out of the tab order and the accessibility
 * tree: it is a picture of the site, and the link laid over it is the one
 * control. The sandbox comes from the shared rule, so it cannot drift from the
 * full viewport's, and the frame waits for the dashboard origin it depends on.
 */
function FramedThumbnail({ url }: Readonly<{ url: string }>) {
  const { ref, scale } = useThumbnailScale();
  const [loaded, setLoaded] = useState(false);
  const origin = useDashboardOrigin();
  const host = displayHost(url);

  return (
    <div
      className="deploy-card__thumb"
      ref={ref}
      style={{ "--thumb-scale": scale } as CSSProperties}
    >
      {!loaded ? (
        <p className="deploy-card__thumb-status">Loading preview…</p>
      ) : null}
      {origin ? (
        <iframe
          className="deploy-card__frame"
          inert
          loading="lazy"
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer"
          sandbox={previewFrameSandbox(url, origin)}
          src={url}
          title={`Preview of ${host}`}
        />
      ) : null}
      <a
        aria-label={`Open ${host} in a new tab`}
        className="deploy-card__thumb-link"
        href={url}
        rel="noreferrer noopener"
        target="_blank"
      />
    </div>
  );
}

function DeploymentThumbnail({ preview }: CardProps) {
  if (canFramePreview(preview) && preview.previewUrl) {
    return <FramedThumbnail url={preview.previewUrl} />;
  }
  return (
    <p className="deploy-card__thumb deploy-card__thumb--empty">
      {previewUnavailableReason(preview)}
    </p>
  );
}

function Fact({
  label,
  wide = false,
  children,
}: Readonly<{ label: string; wide?: boolean; children: React.ReactNode }>) {
  return (
    <div className={wide ? "deploy-card__fact deploy-card__fact--wide" : "deploy-card__fact"}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ExternalLink({ href }: Readonly<{ href: string }>) {
  return (
    <a
      className="deploy-card__link"
      href={href}
      rel="noreferrer noopener"
      target="_blank"
    >
      <span className="deploy-card__link-text">{displayHost(href)}</span>
      <ExternalIcon />
    </a>
  );
}

/**
 * The environment's address. Shown, not linked, while nothing has been
 * released to it: it resolves to nothing yet, and a link that 404s reads as a
 * broken deployment rather than an empty one.
 */
function DomainValue({ preview }: CardProps) {
  if (!preview.previewUrl) return <>—</>;
  if (preview.status === "not_deployed") {
    return (
      <code className="branch-preview__pending-url">
        {displayHost(preview.previewUrl)}
      </code>
    );
  }
  return <ExternalLink href={preview.previewUrl} />;
}

function CommitLine({ preview, repoFullName }: CardProps) {
  const sha = shortCommitSha(preview.commitSha);
  if (!sha) return null;
  const href = commitUrl(repoFullName, preview.commitSha);

  return (
    <span className="deploy-card__source-line">
      <CommitIcon />
      {href ? (
        <a className="deploy-card__sha" href={href} rel="noreferrer noopener" target="_blank">
          {sha}
        </a>
      ) : (
        <span className="deploy-card__sha">{sha}</span>
      )}
      {preview.commitMessage ? (
        <span className="deploy-card__commit-message">
          {preview.commitMessage}
        </span>
      ) : null}
    </span>
  );
}

function DeploymentFacts({ preview, repoFullName }: CardProps) {
  const tone = previewStatusTone(preview.status);

  return (
    <dl className="deploy-card__facts">
      {preview.deploymentUrl ? (
        <Fact label="Deployment" wide>
          <ExternalLink href={preview.deploymentUrl} />
        </Fact>
      ) : null}
      <Fact label="Domains" wide>
        <DomainValue preview={preview} />
      </Fact>
      <Fact label="Status">
        <span className="deploy-card__status">
          <span
            aria-hidden="true"
            className={`deploy-card__dot deploy-card__dot--${tone}`}
          />
          {previewStatusLabel(preview.status)}
        </span>
      </Fact>
      <Fact label="Created">{createdLabel(preview)}</Fact>
      <Fact label="Source" wide>
        <span className="deploy-card__source-line">
          <BranchIcon />
          <span className="deploy-card__branch">{preview.branch}</span>
        </span>
        <CommitLine preview={preview} repoFullName={repoFullName} />
      </Fact>
    </dl>
  );
}

function DeploymentActions({ preview, repoFullName }: CardProps) {
  const github = commitUrl(repoFullName, preview.commitSha);
  const deployed = preview.status !== "not_deployed";

  return (
    <div className="deploy-card__actions">
      {github ? (
        <a
          aria-label="View commit on GitHub"
          className="ghost-button target-action-btn deploy-card__icon-button"
          href={github}
          rel="noreferrer noopener"
          target="_blank"
          title="View commit on GitHub"
        >
          <GithubIcon />
        </a>
      ) : null}
      {preview.inspectorUrl ? (
        <a
          className="ghost-button target-action-btn"
          href={preview.inspectorUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          {deployed ? "Build logs" : "Provider dashboard"}
        </a>
      ) : null}
      {deployed && preview.previewUrl ? (
        <a
          className="primary-button target-action-btn"
          href={preview.previewUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          Visit
        </a>
      ) : null}
    </div>
  );
}

/**
 * One production environment, laid out like the provider's own deployment
 * page: what is live, where it answers, and what put it there.
 */
export function ProductionDeploymentCard({ preview, repoFullName }: CardProps) {
  return (
    <article className="deploy-card">
      <header className="deploy-card__head">
        <div>
          <h2 className="deploy-card__title">Production Deployment</h2>
          <p className="deploy-card__subtitle">
            {previewProviderLabel(preview.provider)} · {preview.targetName}
          </p>
        </div>
        <DeploymentActions preview={preview} repoFullName={repoFullName} />
      </header>
      <div className="deploy-card__body">
        <DeploymentThumbnail preview={preview} />
        <DeploymentFacts preview={preview} repoFullName={repoFullName} />
      </div>
    </article>
  );
}
