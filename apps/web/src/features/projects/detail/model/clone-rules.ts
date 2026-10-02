/* How to clone a repository, as GitHub's own "Clone" box offers it: HTTPS, SSH
 * or the GitHub CLI. Pure: no React, no fetch. */

export type CloneMethod = "https" | "ssh" | "cli";

export interface CloneMethodOption {
  id: CloneMethod;
  label: string;
  /** One line under the field, as GitHub words it. */
  hint: string;
}

export const CLONE_METHODS: ReadonlyArray<CloneMethodOption> = [
  { id: "https", label: "HTTPS", hint: "Clone using the web URL." },
  { id: "ssh", label: "SSH", hint: "Use a password-protected SSH key." },
  { id: "cli", label: "GitHub CLI", hint: "Work fast with the official CLI." },
];

const DEFAULT_HOST = "github.com";
const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** The GitHub host from the repository's web URL; github.com when unknown. */
export function repositoryHost(repoUrl: string | null | undefined): string {
  if (!repoUrl) return DEFAULT_HOST;
  try {
    const host = new URL(repoUrl).host;
    return host || DEFAULT_HOST;
  } catch {
    return DEFAULT_HOST;
  }
}

/**
 * What to paste for `method`, or null when the repository name is not a
 * plain `owner/repo` (nothing is offered rather than a broken command).
 */
export function cloneValue(
  method: CloneMethod,
  repoFullName: string | null | undefined,
  repoUrl?: string | null,
): string | null {
  const name = repoFullName?.trim() ?? "";
  if (!FULL_NAME.test(name)) return null;
  const host = repositoryHost(repoUrl);
  if (method === "https") return `https://${host}/${name}.git`;
  if (method === "ssh") return `git@${host}:${name}.git`;
  // gh resolves the host from its own login; a non-github.com host is named.
  return host === DEFAULT_HOST ? `gh repo clone ${name}` : `gh repo clone ${host}/${name}`;
}

export function cloneMethodOption(method: CloneMethod): CloneMethodOption {
  return CLONE_METHODS.find((option) => option.id === method) ?? CLONE_METHODS[0];
}

/** What the field holds, for labels: a URL, or (GitHub CLI) a command. */
export function cloneNoun(method: CloneMethod): "URL" | "command" {
  return method === "cli" ? "command" : "URL";
}

/**
 * The tab an arrow key moves to in the HTTPS / SSH / GitHub CLI switch
 * (wrapping; Home and End jump), or null for any other key.
 */
export function nextCloneMethodIndex(index: number, key: string, count = CLONE_METHODS.length): number | null {
  const last = count - 1;
  if (key === "ArrowRight") return index >= last ? 0 : index + 1;
  if (key === "ArrowLeft") return index <= 0 ? last : index - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}
