"use client";
import { hostConnectionLabel, hostStatusTone } from "../model/host-types";
import type { useHostAssignmentViewModel } from "../view-models/use-host-assignment-view-model";
export type AssignmentVm = ReturnType<typeof useHostAssignmentViewModel>;
export function AssignmentForm({ vm }: { vm: AssignmentVm }) {
  return (
    <form
      className="hassign-form"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.assign();
      }}
    >
      <label className="hassign-field">
        <span className="hassign-field__label">Machine</span>
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
      <p className="hassign-hint">
        Each environment on a machine needs its own host port. The health path
        must return a success response. Production needs an HTTPS ingress URL.
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
    <fieldset className="hassign-ports">
      <legend className="hassign-field__label">{port.slot}</legend>
      <div className="hassign-ports__grid">
        <label className="hassign-field">
          <span className="hassign-field__hint">Host port</span>
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
        </label>
        <label className="hassign-field">
          <span className="hassign-field__hint">Container port</span>
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
        </label>
        <label className="hassign-field">
          <span className="hassign-field__hint">Health path</span>
          <input
            value={
              vm.config.health.find((item) => item.slot === port.slot)?.path ??
              ""
            }
            placeholder="/health"
            onChange={(event) => vm.health(port.slot, event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
function IngressFields({ vm }: { vm: AssignmentVm }) {
  return (
    <div className="hassign-ingress">
      <label className="hassign-field">
        <span className="hassign-field__label">How users reach it</span>
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
          <option value="direct">Directly on the host port</option>
          <option value="configured">
            Through an existing proxy or domain
          </option>
        </select>
      </label>
      {vm.config.ingress.mode === "configured" ? (
        <label className="hassign-field">
          <span className="hassign-field__label">Public application URL</span>
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
    </div>
  );
}
function AssignmentActions({ vm }: { vm: AssignmentVm }) {
  return (
    <>
      {vm.confirmation ? (
        <p className="hassign-hint">
          Confirm this change. It applies to the next deployment. Containers and
          data already on the machine stay until you stop or remove them.
        </p>
      ) : null}
      <div className="hassign-actions">
        <button
          className="primary-button"
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
  return vm.current ? "Save changes" : "Assign machine";
}
export function AssignmentSummary({ vm }: { vm: AssignmentVm }) {
  if (vm.status === "loading")
    return (
      <p role="status" className="hassign-hint">
        Loading assignment…
      </p>
    );
  if (!vm.current)
    return (
      <div className="hassign-summary hassign-summary--empty">
        <p className="hassign-summary__name">No machine assigned</p>
        <p className="hassign-hint">
          Pick one of your workspace&apos;s machines below so releases have
          somewhere to run.
        </p>
      </div>
    );
  if (vm.current.machineId === null)
    return (
      <div className="hassign-summary">
        <p className="hassign-summary__name">Legacy host: {vm.current.name}</p>
        <p className="hassign-hint">
          Assign a reusable machine below to replace it.
        </p>
      </div>
    );
  const machine = vm.hosts.find((host) => host.id === vm.current?.machineId);
  const label = machine ? hostConnectionLabel(machine) : "Unavailable";
  const { ports, ingress } = vm.current.config;
  return (
    <div className="hassign-summary">
      <div className="hassign-summary__row">
        <p className="hassign-summary__name">
          {machine?.name ?? "Machine unavailable"}
        </p>
        <span className={`status-chip status-chip-${hostStatusTone(label)}`}>
          {label}
        </span>
      </div>
      <dl className="hassign-facts">
        {ports.map((port) => (
          <div key={port.slot}>
            <dt>{port.slot === "frontend" ? "Frontend" : "Backend"}</dt>
            <dd>
              port {port.hostPort} → {port.containerPort}
            </dd>
          </div>
        ))}
        <div>
          <dt>Reached at</dt>
          <dd>
            {ingress.mode === "configured" && ingress.publicUrl ? (
              <a href={ingress.publicUrl} target="_blank" rel="noreferrer">
                {ingress.publicUrl}
              </a>
            ) : (
              "host port on the local network"
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
