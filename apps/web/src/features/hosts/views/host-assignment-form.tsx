"use client";
import {
  hostConnectionLabel,
  hostStatusTone,
  reachedAt,
} from "../model/host-types";
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
      <MachineField vm={vm} />
      {vm.config.ports.map((port) => (
        <PortFields key={port.slot} port={port} vm={vm} />
      ))}
      <IngressFields vm={vm} />
      <p className="hassign-hint">
        AlphaCI picks a free host port on the machine for each service. The
        health path must return a success response. Production needs an HTTPS
        address: your own URL, or the automatic tunnel.
      </p>
      <AssignmentActions vm={vm} />
    </form>
  );
}
/** A choice only when several machines are connected. */
function MachineField({ vm }: { vm: AssignmentVm }) {
  if (vm.choices.length > 1)
    return (
      <label className="hassign-field">
        <span className="hassign-field__label">Machine</span>
        <select
          value={vm.selected}
          onChange={(event) => vm.setSelected(event.target.value)}
          required
        >
          <option value="">Choose a connected machine</option>
          {vm.choices.map((host) => (
            <option value={host.id} key={host.id}>
              {host.name} · {hostConnectionLabel(host)}
            </option>
          ))}
        </select>
      </label>
    );
  const machine =
    vm.hosts.find((host) => host.id === vm.selected) ?? vm.automatic;
  return (
    <div className="hassign-field">
      <span className="hassign-field__label">Machine</span>
      {machine ? (
        <p className="hassign-summary__name">{machine.name}</p>
      ) : (
        <p role="status" className="hassign-hint">
          No machine is connected. Enroll a host, or start its agent, then
          assign.
        </p>
      )}
    </div>
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
          <span className="hassign-field__hint">Container port</span>
          <input
            type="number"
            required
            min={1}
            max={65535}
            value={port.containerPort}
            onChange={(event) => vm.port(port.slot, event.target.value)}
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
  const mode = vm.config.ingress.mode;
  return (
    <div className="hassign-ingress">
      <label className="hassign-field">
        <span className="hassign-field__label">How users reach it</span>
        <select
          value={mode}
          onChange={(event) => {
            const next = event.target.value as typeof mode;
            vm.setConfig((old) => ({
              ...old,
              ingress: {
                mode: next,
                // A tunnel's address is created by the machine, never typed in.
                publicUrl: next === "tunnel" ? null : old.ingress.publicUrl,
              },
            }));
          }}
        >
          <option value="direct">Directly on the host port</option>
          <option value="configured">
            Through an existing proxy or domain
          </option>
          <option value="tunnel">Automatic HTTPS address</option>
        </select>
      </label>
      {mode === "tunnel" ? (
        <p className="hassign-hint">
          AlphaCI gives this environment an HTTPS address. On a server with an apps
          domain it is permanent (for example https://myapp.apps.example.com);
          otherwise it is a tunnel address that changes when the tunnel restarts.
        </p>
      ) : null}
      {mode === "configured" ? (
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
          disabled={vm.busy || !vm.canAssign}
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
  const { ports } = vm.current.config;
  const reach = reachedAt(vm.current.config, vm.current.tunnel);
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
            {reach.kind === "link" ? (
              <a href={reach.href} target="_blank" rel="noreferrer">
                {reach.href}
              </a>
            ) : (
              reach.text
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
