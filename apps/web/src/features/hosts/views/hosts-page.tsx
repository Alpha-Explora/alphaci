"use client";
import "./hosts.css";
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
  return <HostsContent vm={vm} canManage={canManage} />;
}
type HostsVm = ReturnType<typeof useHostsViewModel>;
function HostsContent({ vm, canManage }: { vm: HostsVm; canManage: boolean }) {
  const flowOpen = vm.adding || Boolean(vm.receipt);
  // The pending row for the code on screen is already shown by the guide.
  const hosts = vm.hosts.filter((host) => host.id !== vm.receipt?.id);
  return (
    <section
      className="glass-panel team-detail-surface hosts"
      aria-label="Workspace hosts"
    >
      <HostsHeader vm={vm} showAdd={canManage && !flowOpen} />
      {vm.error ? (
        <p role="alert" className="hosts-alert">
          {vm.error}
        </p>
      ) : null}
      {!canManage ? (
        <p className="hosts-muted">
          You can view hosts. A Developer or admin of this workspace can add and
          manage them.
        </p>
      ) : null}
      {vm.adding ? <AddHostForm vm={vm} /> : null}
      <EnrollmentCard vm={vm} />
      <HostList
        vm={vm}
        hosts={hosts}
        canManage={canManage}
        showEmpty={vm.status === "ready" && !flowOpen}
      />
    </section>
  );
}
function HostsHeader({ vm, showAdd }: { vm: HostsVm; showAdd: boolean }) {
  return (
    <header className="hosts__head">
      <div>
        <h2 className="hosts__title">Hosts</h2>
        <p className="hosts-muted">
          Machines you own where AlphaCI deploys your apps. Add each machine
          once, then pick it for an environment in a project’s Hosting tab.
        </p>
      </div>
      {showAdd ? (
        <button
          className="primary-button"
          type="button"
          onClick={vm.startAdding}
        >
          Add host
        </button>
      ) : null}
    </header>
  );
}
function HostList({
  vm,
  hosts,
  canManage,
  showEmpty,
}: {
  vm: HostsVm;
  hosts: HostsVm["hosts"];
  canManage: boolean;
  showEmpty: boolean;
}) {
  if (vm.status === "loading")
    return (
      <p role="status" className="hosts-muted">
        Loading machines…
      </p>
    );
  if (!hosts.length)
    return showEmpty ? (
      <div className="hosts-empty">
        <p className="hosts-panel__title">No hosts yet</p>
        <ol>
          <li>Name the machine and pick its operating system.</li>
          <li>Run one command on it and paste a one-time code.</li>
          <li>It connects here, ready to receive deployments.</li>
        </ol>
      </div>
    ) : null;
  return (
    <div className="hosts-list">
      {hosts.map((host) => (
        <HostCard key={host.id} host={host} vm={vm} canManage={canManage} />
      ))}
    </div>
  );
}
