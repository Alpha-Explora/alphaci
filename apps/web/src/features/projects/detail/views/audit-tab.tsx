"use client";

import type { ProjectAuditEventsResponse } from "@/shared/api/contracts";
import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

export function AuditTab({
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return <AuditTabBody error={vm.auditError} response={vm.audit} />;
}

function AuditTabBody({
  error,
  response,
}: Readonly<{
  error: string | null;
  response: ProjectAuditEventsResponse | null;
}>) {
  if (error) {
    return (
      <p className="error-text" style={{ margin: 0 }}>
        {error}
      </p>
    );
  }
  if (response?.items.length) {
    return (
      <div className="env-metadata-list">
        {response.items.map((event) => (
          <AuditEventRow
            key={event.id}
            eventCode={event.eventCode}
            message={event.message}
          />
        ))}
      </div>
    );
  }
  return <p className="env-empty-state">No audit events yet.</p>;
}

function AuditEventRow({
  eventCode,
  message,
}: Readonly<{ eventCode: string; message: string }>) {
  return (
    <div className="env-metadata-row provisioned">
      <span>{eventCode}</span>
      <span>{message}</span>
    </div>
  );
}
