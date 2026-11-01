import Link from "next/link";

import type { AppRole } from "@/shared/api/contracts";

import {
  projectDashboardHref,
  repoChipOpens,
  repoDisplayName,
  repoRoleLabel,
} from "../model/project-folder-rules";
import type { RepoRole } from "../model/project-folder-types";

/**
 * One repository as a compact chip: its role, then its short name. Linked
 * repositories open their project dashboard; an unlinked one has nowhere to
 * go, so it is drawn as plain text and says why. For the QA Team and Product
 * owners only the frontend opens (`repoChipOpens`); the rest are labels.
 */
export function RepoChip({
  name,
  repoFullName,
  role,
  projectId,
  appRole,
}: Readonly<{
  name: string;
  repoFullName: string | null;
  role: RepoRole | null;
  projectId: string | null;
  appRole: AppRole | null | undefined;
}>) {
  const label = repoDisplayName({ name, repoFullName });
  const roleLabel = role ? repoRoleLabel(role) : "Not linked";
  const body = (
    <>
      <span className="pf-chip__role">{roleLabel}</span>
      <span className="pf-chip__name">{label}</span>
    </>
  );
  if (!projectId) {
    return (
      <span className="pf-chip pf-chip--unlinked" title={`${label} is not linked to an AlphaCI project yet`}>
        {body}
      </span>
    );
  }
  if (!repoChipOpens(appRole, role)) {
    return (
      <span className="pf-chip" data-role={role ?? undefined}>
        {body}
      </span>
    );
  }
  return (
    <Link
      className="pf-chip"
      data-role={role ?? undefined}
      href={projectDashboardHref(projectId)}
      title={`Open the ${label} dashboard`}
    >
      {body}
    </Link>
  );
}
