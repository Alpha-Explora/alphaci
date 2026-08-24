"use client";

import { useProjectDomainsViewModel } from "../view-models/use-project-domains-view-model";
import { ProjectDomainsView } from "./project-domains-view";

/**
 * Connected panel: owns the ViewModel so a host surface can drop domains in
 * without knowing how they load. Kept separate from ProjectDomainsView so the
 * presentation stays testable without a fetch.
 */
export function ProjectDomainsPanel({
  projectId,
  enabled,
  targets,
}: Readonly<{
  projectId: string;
  enabled: boolean;
  targets: Array<{ id: string; label: string }>;
}>) {
  const {
    domains,
    status,
    error,
    busyDomainId,
    isAdding,
    addDomain,
    verifyDomain,
    removeDomain,
  } = useProjectDomainsViewModel({ projectId, enabled });

  return (
    <ProjectDomainsView
      busyDomainId={busyDomainId}
      domains={domains}
      error={error}
      isAdding={isAdding}
      onAdd={addDomain}
      onRemove={(id) => void removeDomain(id)}
      onVerify={(id) => void verifyDomain(id)}
      status={status}
      targets={targets}
    />
  );
}
