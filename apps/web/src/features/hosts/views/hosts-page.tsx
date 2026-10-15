"use client";
import { TeamPageShell } from "@/features/teams/shell";
import { useCapabilities } from "@/features/capabilities/current";
import { canManageHosts } from "../model/host-types";
import { useHostsViewModel } from "../view-models/use-hosts-view-model";
import { useHostAvailability } from "../view-models/use-host-availability";
import { AddHostForm, EnrollmentCard, HostCard } from "./host-cards";
export function HostsPage() {
  return (
    <TeamPageShell
      loadingLabel="Loading hosts"
      path="/hosts"
      heading={{ title: (team) => (team ? `Hosts · ${team.name}` : "Hosts") }}
    >
      {({ team, session }) => (
        <WorkspaceHosts
          key={team.id}
          workspaceId={team.id}
          canManage={canManageHosts(session?.appRole, team.role)}
        />
      )}
    </TeamPageShell>
  );
}
function WorkspaceHosts({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) {
  const { envProvisioningEnabled, status: capabilityStatus } =
    useCapabilities();
  const availability = useHostAvailability(envProvisioningEnabled);
  const vm = useHostsViewModel(
    workspaceId,
    canManage,
    availability === "enabled",
  );
  if (capabilityStatus === "loading" || availability === "loading")
    return <p role="status">Loading host capability…</p>;
  if (availability !== "enabled")
    return <p>On-prem hosting is unavailable for this deployment.</p>;
  return (
    <section
      className="glass-panel team-detail-surface"
      aria-label="Workspace hosts"
      style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}
    >
      <header>
        <h2>Hosts</h2>
        <p>
          Enroll a machine once, then assign project environments to it from
          Hosting.
        </p>
      </header>
      {vm.error ? (
        <p role="alert" className="error-text">
          {vm.error}
        </p>
      ) : null}
      {canManage ? (
        <AddHostForm vm={vm} />
      ) : (
        <p>
          Your role can view hosts. A Developer or admin with workspace access
          can enroll and assign them.
        </p>
      )}
      <EnrollmentCard vm={vm} />
      {vm.status === "loading" ? <p role="status">Loading machines…</p> : null}
      {vm.hosts.length === 0 && vm.status === "ready" ? (
        <p>No hosts enrolled in this workspace.</p>
      ) : null}
      {vm.hosts.map((host) => (
        <HostCard key={host.id} host={host} vm={vm} canManage={canManage} />
      ))}
    </section>
  );
}
