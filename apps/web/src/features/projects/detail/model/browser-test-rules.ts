/**
 * "Add browser tests": whether a project's dev branch has ALPHACI's starter
 * Playwright pack (page loads, links, accessibility, visual snapshots), and
 * what opening the pull request that adds it said.
 *
 * Types mirror the backend's `BrowserTestsService` (alphaci-golden-copy-be
 * #153) exactly. Every sentence and precedence lives here so it is tested.
 * Pure: no React, no fetch.
 */

import { ApiError } from "@/shared/api/request";

import { apiErrorReason } from "./api-error-reason";
import { needsGithubSignIn } from "./github-read-failure";
import { reinstallSecretsSignInHref } from "./project-detail-tab-rules";

/* ── Wire ───────────────────────────────────────────────────────────────── */

/** GET workspace/browser-tests. */
export interface BrowserTestsStatus {
  installed: boolean;
  /** The branch the pack is read from and added to: always the working branch. */
  branch: string;
  missingFiles: string[];
  presentFiles: string[];
  hasLockfile: boolean;
  playwrightVersion: string | null;
  /**
   * Whether the repository is a Next.js or React frontend. Optional only for a
   * backend from before the field existed.
   */
  frontend?: boolean;
  /** False for a role that cannot add, no dev branch, or a non-frontend repo. */
  canAdd: boolean;
  /** Why `canAdd` is false, in the server's words; null when it is true. */
  reason: string | null;
}

/** 201 from POST workspace/browser-tests. */
export interface BrowserTestsAdded {
  pullRequestNumber: number;
  branch: string;
  filesAdded: string[];
  filesSkipped: string[];
  filesUpdated: string[];
  /** Plain sentences about what was left alone; one may end in a code block. */
  notes: string[];
}

/* ── What the card shows ────────────────────────────────────────────────── */

export const INSTALLED_LINE = "Browser tests installed: page loads, links, accessibility, visual";

/**
 * The backend's sentence for a repository with no Next.js or React
 * dependency: a fallback for a backend that does not send `frontend` yet.
 * The explicit flag wins, because `reason` reports the role or a missing dev
 * branch first and so cannot reliably identify a backend repository.
 */
const NOT_FRONTEND_REASON = "This repository does not look like a frontend project";

export type BrowserTestsCardState = "hidden" | "installed" | "missing";

/** Hidden while loading, after a failed read, and for a non-frontend repository. */
export function browserTestsCardState(status: BrowserTestsStatus | null): BrowserTestsCardState {
  if (!status) return "hidden";
  if (status.frontend === false) return "hidden";
  if (status.installed) return "installed";
  if (status.frontend === undefined && status.reason?.startsWith(NOT_FRONTEND_REASON)) return "hidden";
  return "missing";
}

/** The four checks and the setup they share, as someone reading the card says them. */
const FILE_LABELS: Readonly<Record<string, string>> = {
  "tests/e2e/pages.e2e-spec.ts": "Page loads",
  "tests/e2e/links.e2e-spec.ts": "Links",
  "tests/e2e/a11y.e2e-spec.ts": "Accessibility",
  "tests/e2e/visual.e2e-spec.ts": "Visual snapshots",
  "tests/e2e/support.ts": "Shared test setup",
  "playwright.config.ts": "Playwright config",
};

const LABEL_ORDER = Object.values(FILE_LABELS);

/**
 * What is missing, in plain words and the order above. A path this client
 * does not know is shown as the path, never dropped.
 */
export function missingChecks(missingFiles: readonly string[]): string[] {
  const labels = new Set(missingFiles.map((path) => FILE_LABELS[path] ?? path));
  return [...labels].sort((a, b) => rank(a) - rank(b));
}

function rank(label: string): number {
  const index = LABEL_ORDER.indexOf(label);
  return index === -1 ? LABEL_ORDER.length : index;
}

export const ADD_BUTTON_LABEL = "Add browser tests";

/** "Pull request #12 opened into dev". */
export function openedLabel(added: Pick<BrowserTestsAdded, "pullRequestNumber">, base: string): string {
  return `Pull request #${String(added.pullRequestNumber)} opened into ${base}`;
}

/** One note as text and, when it carries a fenced block, that code apart. */
export interface BrowserTestsNote {
  text: string;
  code: string | null;
}

/**
 * The config-snippet note arrives as Markdown ("…needs this in its config:
 * ```ts …```"). The card has no Markdown renderer, so the fence is lifted out
 * and shown as code rather than as backticks.
 */
export function splitNote(note: string): BrowserTestsNote {
  const match = /```[a-z]*\n([\s\S]*?)```/.exec(note);
  if (!match) return { text: note.trim(), code: null };
  return { text: note.slice(0, match.index).trim(), code: (match[1] ?? "").trimEnd() };
}

/* ── An add that failed ─────────────────────────────────────────────────── */

export type BrowserTestsErrorKind =
  | "reauth"
  | "pr-open"
  | "forbidden"
  | "write-forbidden"
  | "no-dev-branch"
  | "nothing-to-add"
  | "branch-taken"
  | "pr-refused"
  | "not-frontend"
  | "failed";

export interface BrowserTestsError {
  kind: BrowserTestsErrorKind;
  /** Display text, never the server's object. */
  message: string;
  /** PR open: the pull request already open, for the in-app link. */
  pullRequestNumber: number | null;
  /** Reauth: login, then back to this project. */
  signInHref: string | null;
}

const CODE_KINDS: Readonly<Record<string, BrowserTestsErrorKind>> = {
  GITHUB_REAUTH: "reauth",
  BROWSER_TESTS_PR_OPEN: "pr-open",
  BROWSER_TESTS_ROLE_FORBIDDEN: "forbidden",
  GITHUB_WRITE_FORBIDDEN: "write-forbidden",
  BROWSER_TESTS_NO_DEV_BRANCH: "no-dev-branch",
  BROWSER_TESTS_NOTHING_TO_ADD: "nothing-to-add",
  BROWSER_TESTS_BRANCH_TAKEN: "branch-taken",
  BROWSER_TESTS_PR_REFUSED: "pr-refused",
  BROWSER_TESTS_NOT_FRONTEND: "not-frontend",
};

const MESSAGES: Readonly<Record<Exclude<BrowserTestsErrorKind, "pr-open" | "pr-refused" | "failed">, string>> = {
  reauth: "GitHub needs you to sign in again before ALPHACI can open this pull request.",
  forbidden: "Only developers, team leads and admins can add browser tests.",
  "write-forbidden":
    "GitHub did not let your account write to this repository, so no pull request was opened. Ask a repository admin for write access.",
  "no-dev-branch": "This repository has no dev branch yet, and browser tests are added there. Create dev, then try again.",
  "nothing-to-add": "The browser tests are already in this repository, so there was nothing to add.",
  "branch-taken":
    "Every alphaci/browser-tests branch name is already taken. Delete an old one in the repository, then try again.",
  "not-frontend":
    "This repository doesn't look like a frontend project (no Next.js or React in package.json), so browser tests weren't added.",
};

const FALLBACK = "The pull request could not be opened. Try again in a moment.";

function details(cause: unknown): Record<string, unknown> | null {
  if (!(cause instanceof ApiError)) return null;
  const body = cause.details;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
}

function kindOf(cause: unknown): BrowserTestsErrorKind {
  const code = details(cause)?.code;
  const known = typeof code === "string" ? CODE_KINDS[code.toUpperCase()] : undefined;
  if (known) return known;
  return needsGithubSignIn(cause) ? "reauth" : "failed";
}

function openNumber(cause: unknown): number | null {
  const value = details(cause)?.pullRequestNumber;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function messageFor(kind: BrowserTestsErrorKind, cause: unknown, open: number | null): string {
  if (kind === "pr-open") {
    return open === null
      ? "A browser-tests pull request is already open."
      : `A browser-tests pull request is already open: #${String(open)}`;
  }
  if (kind === "pr-refused") {
    return apiErrorReason(cause, "The files were committed, but GitHub refused to open the pull request.");
  }
  if (kind === "failed") return apiErrorReason(cause, FALLBACK);
  return MESSAGES[kind];
}

/**
 * What a refused "Add browser tests" says, by the backend's `code`. A 401 or
 * `GITHUB_REAUTH` is the app's usual sign-in-again case, with its link.
 */
export function browserTestsError(cause: unknown, projectId: string): BrowserTestsError {
  const kind = kindOf(cause);
  const open = kind === "pr-open" ? openNumber(cause) : null;
  return {
    kind,
    message: messageFor(kind, cause, open),
    pullRequestNumber: open,
    signInHref: kind === "reauth" ? reinstallSecretsSignInHref(projectId) : null,
  };
}
