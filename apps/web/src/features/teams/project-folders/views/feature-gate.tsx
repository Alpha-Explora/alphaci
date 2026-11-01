"use client";

import Link from "next/link";

import {
  FEATURE_NUDGE_MESSAGE,
  FEATURES_REQUIRED_NOTE,
  type AddRepositoryState,
} from "../model/project-folder-rules";
import { FeatureIcon, LockIcon, PlusIcon } from "./project-folder-icons";

/**
 * "Add repository": the wizard filed in this Project, or, while the Project
 * has no Feature yet, the same control disabled (aria-disabled, so it stays
 * focusable and its reason is read out) and described by the note beside it.
 * Never a dead link.
 */
export function AddRepositoryAction({
  state,
  href,
  className,
  ariaLabel,
  noteId,
  showLabel = true,
}: Readonly<{
  state: AddRepositoryState;
  href: string;
  className: string;
  /** A fuller accessible name (a card names its Project); the visible label otherwise. */
  ariaLabel?: string;
  /** The id of the visible note that explains a blocked control. */
  noteId: string;
  /** Cards wrap the label in their own span (hidden on phones). */
  showLabel?: boolean;
}>) {
  if (state === "hidden") return null;
  const label = showLabel ? "Add repository" : <span className="pf-card__manage-label">Add repository</span>;
  if (state === "enabled") {
    return (
      <Link className={className} href={href} aria-label={ariaLabel}>
        <PlusIcon />
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`${className} pf-add--blocked`}
      aria-label={ariaLabel}
      aria-disabled="true"
      aria-describedby={noteId}
    >
      <LockIcon />
      {label}
    </button>
  );
}

/** Why a Developer cannot add a repository yet. */
export function FeaturesRequiredNote({ id, className = "pf-gate-note" }: Readonly<{ id: string; className?: string }>) {
  return (
    <p className={className} id={id}>
      <LockIcon />
      {FEATURES_REQUIRED_NOTE}
    </p>
  );
}

/**
 * A Product owner's (or admin's) nudge on a Project with no Feature: the
 * action opens that Project's New Feature dialog.
 */
export function FeatureNudge({
  projectName,
  onAddFeature,
  className = "pf-nudge",
}: Readonly<{ projectName: string; onAddFeature: () => void; className?: string }>) {
  return (
    <div className={className}>
      <span className="pf-nudge__text">
        <FeatureIcon />
        {FEATURE_NUDGE_MESSAGE}
      </span>
      <button
        type="button"
        className="pf-nudge__action"
        aria-label={`Add a Feature to ${projectName}`}
        onClick={onAddFeature}
      >
        <PlusIcon />
        Add a Feature
      </button>
    </div>
  );
}
