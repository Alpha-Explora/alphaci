/* Pure rules for the Commits tab: reading GET /projects/:id/commits
 * defensively, the branch selector's options, and how each commit is labelled.
 * No React, no fetch.
 *
 * A missing field only ever makes a row plainer: no pull request number means
 * no link (and, on dev/uat/main, the "Direct push" tag unless ALPHACI's own
 * GitHub App made the commit); no login falls back to the author's name; a
 * row without a SHA is dropped. */

import type { ProjectCommitsResponse } from "@/shared/api/contracts";

/** Rows per request. */
export const COMMITS_PAGE_SIZE = 30;

/**
 * The branches every ALPHACI repository promotes through, in promotion order.
 * The Commits tab's selector offers exactly these (the ones that exist). A
 * commit on one of them without a pull request skipped review.
 */
export const PROMOTION_BRANCHES: ReadonlyArray<string> = ["dev", "uat", "main"];

/** One commit as the list draws it. */
export interface CommitRow {
  sha: string;
  shortSha: string;
  /** The first line of the message. */
  title: string;
  /** The GitHub login, else the author's name. */
  author: string;
  authoredAt: string;
  /** The pull request that brought it in, opened in ALPHACI's Pull requests tab. */
  pullRequestNumber: number | null;
  /** On dev, uat or main, by a person, without a pull request: it skipped review. */
  directPush: boolean;
  /** Written by ALPHACI's GitHub App (the setup commits): not a direct push. */
  alphaciSetup: boolean;
}

export interface CommitsPage {
  /** The branch these commits are on; null when the response did not say. */
  branch: string | null;
  branches: string[];
  items: CommitRow[];
  /** Pass back unchanged as `?before=`; null on the last page. */
  next: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** The message's first non-empty line; "(no message)" when there is none. */
export function commitTitle(message: string | null | undefined): string {
  const line = (message ?? "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ?? "(no message)";
}

/** The login, else the name, else "Unknown author". */
export function commitAuthor(login: string | null | undefined, name: string | null | undefined): string {
  return text(login) ?? text(name) ?? "Unknown author";
}

/** Seven characters, as git prints it, when the server sent no short form. */
export function shortShaOf(sha: string, shortSha?: string | null): string {
  return text(shortSha) ?? sha.slice(0, 7);
}

/**
 * ALPHACI's own GitHub App: GitHub reports its commits with a `[bot]` login
 * (`alphaci-enterprise[bot]`). The commits API sends `authorLogin` and
 * `authorName` only, no account type, so the login (or, with none, the name)
 * must be a `[bot]` account whose name starts with "alphaci". Other bots, such
 * as dependabot, are not matched.
 */
const ALPHACI_BOT = /^alphaci[\w.-]*\[bot\]$/i;

export function isAlphaciBot(login: string | null | undefined, name: string | null | undefined): boolean {
  return ALPHACI_BOT.test(text(login) ?? text(name) ?? "");
}

/** A person's commit on a promotion branch with no pull request behind it. */
export function isDirectPush(
  branch: string | null,
  pullRequestNumber: number | null,
  alphaciSetup = false,
): boolean {
  return !alphaciSetup && pullRequestNumber === null && branch !== null && PROMOTION_BRANCHES.includes(branch);
}

function rowFrom(value: unknown, branch: string | null): CommitRow | null {
  const raw = record(value);
  const sha = text(raw?.sha);
  if (!raw || !sha) return null;
  const pullRequestNumber = positiveInteger(raw.pullRequestNumber);
  const alphaciSetup = isAlphaciBot(text(raw.authorLogin), text(raw.authorName));
  return {
    sha,
    shortSha: shortShaOf(sha, text(raw.shortSha)),
    title: commitTitle(text(raw.message)),
    author: commitAuthor(text(raw.authorLogin), text(raw.authorName)),
    authoredAt: text(raw.authoredAt) ?? "",
    pullRequestNumber,
    directPush: isDirectPush(branch, pullRequestNumber, alphaciSetup),
    alphaciSetup: alphaciSetup && pullRequestNumber === null,
  };
}

function branchNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value.map(text).filter((name): name is string => name !== null);
  return [...new Set(names)];
}

/** One page of the response, read defensively. */
export function normalizeCommitsPage(value: ProjectCommitsResponse | unknown): CommitsPage {
  const raw = record(value);
  const branch = text(raw?.branch);
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    branch,
    branches: branchNames(raw?.branches),
    items: items.map((item) => rowFrom(item, branch)).filter((row): row is CommitRow => row !== null),
    next: text(raw?.next),
  };
}

/** A further page appended to what is shown, without repeating a commit. */
export function appendCommitsPage(current: CommitsPage, page: CommitsPage): CommitsPage {
  const seen = new Set(current.items.map((row) => row.sha));
  return {
    ...current,
    items: [...current.items, ...page.items.filter((row) => !seen.has(row.sha))],
    next: page.next,
  };
}

/**
 * The selector's options: dev, uat, main — those the repository has — in
 * promotion order. The shown branch is always offered, even when it is not one
 * of them (a deep link) or an older backend sent no branch list.
 */
export function branchOptions(branches: ReadonlyArray<string>, current: string | null): string[] {
  const all = current && !branches.includes(current) ? [...branches, current] : [...branches];
  const promotion = PROMOTION_BRANCHES.filter((name) => all.includes(name));
  return current && !promotion.includes(current) ? [...promotion, current] : promotion;
}

/** The label of ALPHACI's own setup commits, in place of a Direct push tag. */
export const ALPHACI_SETUP_LABEL = "ALPHACI setup";

/** What the list says when a branch has no commits. */
export function commitsEmptyMessage(branch: string | null): string {
  return branch ? `No commits on ${branch} yet.` : "No commits yet.";
}

/** The pull request link's accessible name. */
export function commitPullRequestLabel(pullRequestNumber: number): string {
  return `Open pull request #${pullRequestNumber} in Pull requests`;
}

export function commitsLoadMoreLabel(loading: boolean): string {
  return loading ? "Loading..." : "Load more";
}

/** The copy button's text: the short SHA, or "Copied" for a moment after. */
export function shaCopyLabel(shortSha: string, copied: boolean): string {
  return copied ? "Copied" : shortSha;
}
