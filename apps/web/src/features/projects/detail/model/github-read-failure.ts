/* Pure: what a failed read of GitHub-backed data means to the person reading.
 *
 * The backend reads GitHub with the viewer's stored token. When that token has
 * been revoked or has expired it answers 401, or a 4xx carrying the code
 * `GITHUB_REAUTH`; both mean the same thing here — sign in again — and are
 * shown with a link rather than as a dead end. No React, no fetch. */

import { reinstallSecretsSignInHref } from "./project-detail-tab-rules";

export type GithubReadFailureKind = "reauth" | "not-found" | "error";

export interface GithubReadFailure {
  kind: GithubReadFailureKind;
  /** Display text. Never the server's object. */
  message: string;
  /** Set only for "reauth": login, then back to this project. */
  signInHref: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function failureStatus(cause: unknown): number | null {
  const status = record(cause)?.status;
  return typeof status === "number" ? status : null;
}

function failureCode(cause: unknown): string {
  const details = record(record(cause)?.details);
  const code = details?.code ?? record(details?.error)?.code;
  return typeof code === "string" ? code.toUpperCase() : "";
}

/** True when GitHub needs the viewer to sign in again before this can work. */
export function needsGithubSignIn(cause: unknown): boolean {
  return failureCode(cause) === "GITHUB_REAUTH" || failureStatus(cause) === 401;
}

/**
 * The failure as something to show. `subject` finishes the sentences
 * ("show this repository's commits"); `notFound` is what a 404 means for it.
 */
export function githubReadFailure(
  cause: unknown,
  input: Readonly<{ projectId: string; subject: string; notFound: string; fallback: string }>,
): GithubReadFailure {
  if (needsGithubSignIn(cause)) {
    return {
      kind: "reauth",
      message: `GitHub needs you to sign in again before ALPHACI can ${input.subject}.`,
      signInHref: reinstallSecretsSignInHref(input.projectId),
    };
  }
  if (failureStatus(cause) === 404) {
    return { kind: "not-found", message: input.notFound, signInHref: null };
  }
  return { kind: "error", message: input.fallback, signInHref: null };
}
