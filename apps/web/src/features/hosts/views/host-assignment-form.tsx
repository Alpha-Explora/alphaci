"use client";
import { hostConnectionLabel } from "../model/host-types";
import type { useHostAssignmentViewModel } from "../view-models/use-host-assignment-view-model";
export type AssignmentVm = ReturnType<typeof useHostAssignmentViewModel>;
export function AssignmentForm({ vm }: { vm: AssignmentVm }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void vm.assign();
      }}
      style={{ display: "grid", gap: 8 }}
    >
      <label>
        Machine{" "}
        <select
          value={vm.selected}
          onChange={(event) => vm.setSelected(event.target.value)}
          required
        >
          <option value="">Choose an enrolled machine</option>
          {vm.hosts.map((host) => (
            <option value={host.id} key={host.id}>
              {host.name} · {hostConnectionLabel(host)}
            </option>
          ))}
        </select>
      </label>
      {vm.config.ports.map((port) => (
        <PortFields key={port.slot} port={port} vm={vm} />
      ))}
      <IngressFields vm={vm} />
      <p>
        Use different host ports for every environment on this machine. Health
        paths must respond successfully. Production requires an existing HTTPS
        ingress.
      </p>
      <AssignmentActions vm={vm} />
    </form>
  );
}
function PortFields({
  port,
  vm,
}: {
  port: AssignmentVm["config"]["ports"][number];
  vm: AssignmentVm;
}) {
  return (
    <fieldset>
      <legend>{port.slot}</legend>
      <label>
        Host port{" "}
        <input
          type="number"
          required
          min={1}
          max={65535}
          value={port.hostPort}
          onChange={(event) =>
            vm.port(port.slot, "hostPort", event.target.value)
          }
        />
      </label>{" "}
      <label>
        Container port{" "}
        <input
          type="number"
          required
          min={1}
          max={65535}
          value={port.containerPort}
          onChange={(event) =>
            vm.port(port.slot, "containerPort", event.target.value)
          }
        />
      </label>{" "}
      <label>
        Health path{" "}
        <input
          value={
            vm.config.health.find((item) => item.slot === port.slot)?.path ?? ""
          }
          placeholder="/health"
          onChange={(event) => vm.health(port.slot, event.target.value)}
        />
      </label>
    </fieldset>
  );
}
function IngressFields({ vm }: { vm: AssignmentVm }) {
  return (
    <>
      <label>
        Ingress{" "}
        <select
          value={vm.config.ingress.mode}
          onChange={(event) =>
            vm.setConfig((old) => ({
              ...old,
              ingress: {
                ...old.ingress,
                mode: event.target.value as "direct" | "configured",
              },
            }))
          }
        >
          <option value="direct">Direct host ports</option>
          <option value="configured">Existing ingress or reverse proxy</option>
        </select>
      </label>
      {vm.config.ingress.mode === "configured" ? (
        <label>
          Public application URL{" "}
          <input
            type="url"
            required
            value={vm.config.ingress.publicUrl ?? ""}
            placeholder="https://app.example.com"
            onChange={(event) =>
              vm.setConfig((old) => ({
                ...old,
                ingress: {
                  ...old.ingress,
                  publicUrl: event.target.value || null,
                },
              }))
            }
          />
        </label>
      ) : null}
    </>
  );
}
function AssignmentActions({ vm }: { vm: AssignmentVm }) {
  return (
    <>
      {vm.confirmation ? (
        <p>
          Confirm this change. It affects future work. Existing containers and
          data stay on the host until explicitly stopped or removed.
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="ghost-button"
          type="submit"
          disabled={vm.busy || !vm.selected}
        >
          {assignLabel(vm)}
        </button>
        {vm.current ? (
          <button
            className="ghost-button"
            type="button"
            disabled={vm.busy}
            onClick={() => void vm.unassign()}
          >
            {vm.confirmation === "unassign" ? "Confirm unassign" : "Unassign"}
          </button>
        ) : null}
        {vm.confirmation ? (
          <button className="ghost-button" type="button" onClick={vm.cancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </>
  );
}
function assignLabel(vm: AssignmentVm) {
  if (vm.confirmation === "replace") return "Confirm replacement";
  return vm.current ? "Save assignment" : "Assign machine";
}
export function AssignmentSummary({ vm }: { vm: AssignmentVm }) {
  if (vm.status === "loading") return <p role="status">Loading assignment…</p>;
  if (!vm.current) return <p>No reusable machine assigned.</p>;
  if (vm.current.machineId === null)
    return (
      <p>
        Legacy host: {vm.current.name}. Confirm a replacement to switch to a
        reusable machine.
      </p>
    );
  const machine = vm.hosts.find((host) => host.id === vm.current?.machineId);
  return (
    <p>
      {machine?.name ?? "Machine unavailable"} · revision {vm.current.revision}
    </p>
  );
}
