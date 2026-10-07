/* Where a repository's QA happens. Pure: no React, no fetch, no Next.
 *
 * A repository filed under a Project is verified by the Project's QA run and
 * its developers work from the Project's requirements. A repository with no
 * Project (or a page that could not read its Project — an older backend)
 * keeps the per-repository screens, which a newer backend serves as
 * read-only history. */

export type QaScope =
  /** The repository's Project is still being read: show nothing yet rather than the wrong screen. */
  | { kind: "pending" }
  | {
      kind: "project";
      deliveryProjectId: string;
      projectName: string;
      /** The Projects page opened on this Project, when the team is known. */
      projectHref: string | null;
    }
  /** No Project, or it could not be read. */
  | { kind: "repository" };

export const REPOSITORY_SCOPE: QaScope = { kind: "repository" };

/**
 * The scope from the project page's folder read. `idle` (the read is not
 * enabled) and `unavailable` (no folder, a 404, any failure) both keep the
 * per-repository screens: they worked before Projects existed.
 */
export function qaScopeFromFolder(
  status: "idle" | "loading" | "ready" | "unavailable",
  folder: { deliveryProjectId: string | null; name: string | null; href: string | null } | null,
): QaScope {
  if (status === "loading") return { kind: "pending" };
  if (status !== "ready" || !folder?.deliveryProjectId) return REPOSITORY_SCOPE;
  return {
    kind: "project",
    deliveryProjectId: folder.deliveryProjectId,
    projectName: folder.name?.trim() || "this Project",
    projectHref: folder.href,
  };
}

/**
 * The scope for a page that carries the Project's QA itself: every role's
 * repository page, whose Checklists tab embeds the Project's Requirements, QA
 * run and My QA items. Nothing links away to the Projects page: with no
 * `projectHref`, "Open checklist" stays on this page.
 */
export function withProjectOnPage(scope: QaScope): QaScope {
  return scope.kind === "project" ? { ...scope, projectHref: null } : scope;
}
