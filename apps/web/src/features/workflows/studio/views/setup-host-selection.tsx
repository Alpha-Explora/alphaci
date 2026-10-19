"use client";
import Link from "next/link";
import { Fragment, useEffect, useId, useRef } from "react";
import { healthyHosts, type MachineSummary } from "@/features/hosts";
import type { EnvironmentDraft } from "../model/project-environments-rules";
import {
  defaultHostAssignment,
  refitHostAssignmentDefaults,
  slotContainerPort,
  slotHealthPath,
  withSlotContainerPort,
  withSlotHealthPath,
  type HostSlot,
  type SlotRuntimes,
} from "../model/setup-host-assignment-rules";
import type { useSetupHostSelection } from "../view-models/use-setup-host-selection";

/** Select value for the workspace's only connected machine, chosen by the server. */
const AUTOMATIC = "automatic";

type AssignmentConfig = NonNullable<
  EnvironmentDraft["hostAssignment"]
>["config"];

/** A change to one environment's assignment config. */
type ConfigChange = (
  index: number,
  update: (config: AssignmentConfig) => AssignmentConfig,
) => void;

const SLOT_LABELS: Record<HostSlot, string> = {
  backend: "Backend",
  frontend: "Frontend",
};

export function SetupHostSelection({
  environments,
  hostProblems,
  hostSelection: vm,
  onChange,
  slots,
  runtimes,
}: {
  environments: readonly EnvironmentDraft[];
  /** Each environment's problem, or null; computed once by the wizard. */
  hostProblems: readonly (string | null)[];
  hostSelection: ReturnType<typeof useSetupHostSelection>;
  onChange: (value: EnvironmentDraft[]) => void;
  /** The slots each environment's host runs: one, or backend and frontend for two repositories. */
  slots: readonly HostSlot[];
  /** Each slot's container port and health path, from the backend's catalog. */
  runtimes?: SlotRuntimes;
}) {
  const workspace = useRef(vm.workspaceId);
  // A different project type behind a slot brings its own port and health
  // path to the values that were only pre-filled.
  const pastRuntimes = useRef(runtimes);
  useEffect(() => {
    const previous = pastRuntimes.current;
    if (JSON.stringify(previous) === JSON.stringify(runtimes)) return;
    pastRuntimes.current = runtimes;
    const next = refitHostAssignmentDefaults(environments, previous, runtimes);
    if (next !== environments) onChange([...next]);
  }, [runtimes, environments, onChange]);
  useEffect(() => {
    if (workspace.current === vm.workspaceId) return;
    workspace.current = vm.workspaceId;
    onChange(
      environments.map((environment) => {
        const next = { ...environment };
        delete next.hostAssignment;
        return next;
      }),
    );
  }, [vm.workspaceId, environments, onChange]);
  const choices = healthyHosts(vm.hosts);
  function select(index: number, value: string) {
    onChange(
      environments.map((environment, position) => {
        if (position !== index) return environment;
        const rest = { ...environment };
        delete rest.hostAssignment;
        if (!value) return rest;
        return {
          ...rest,
          hostAssignment: defaultHostAssignment(
            environment,
            slots,
            value === AUTOMATIC ? undefined : value,
            runtimes,
          ),
        };
      }),
    );
  }
  const change: ConfigChange = (index, update) => {
    onChange(
      environments.map((environment, position) => {
        if (index !== position || !environment.hostAssignment)
          return environment;
        const binding = environment.hostAssignment;
        return {
          ...environment,
          hostAssignment: { ...binding, config: update(binding.config) },
        };
      }),
    );
  };
  return (
    <section className="wizard-machines" aria-label="Choose on-prem machines">
      <div className="wizard-machines__header">
        <h4 className="wizard-field__label">Machines</h4>
        <div className="wizard-machines__actions">
          <Link
            className="ghost-button wizard-machines__action"
            target="_blank"
            href={`/hosts${vm.workspaceId ? `?workspace=${encodeURIComponent(vm.workspaceId)}` : ""}`}
          >
            Add a host
          </Link>
          <button
            type="button"
            className="ghost-button wizard-machines__action"
            onClick={vm.refresh}
          >
            Refresh hosts
          </button>
        </div>
      </div>
      <p className="wizard-field__hint">{setupHostIntro(choices)}</p>
      {vm.error ? (
        <p
          className="wizard-field__hint wizard-field__hint--error"
          role="status"
        >
          {vm.error}
        </p>
      ) : null}
      {choices.length ? (
        <div className="wizard-machines__rows">
          {environments.map((environment, index) => (
            <SetupHostRow
              key={environment.slug}
              environment={environment}
              index={index}
              choices={choices}
              problem={hostProblems[index] ?? null}
              select={select}
              change={change}
              slots={slots}
              runtimes={runtimes}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function setupHostIntro(choices: readonly MachineSummary[]): string {
  if (!choices.length)
    return "No machine is connected yet. Enroll one; environments are assigned to it from Hosting.";
  if (choices.length === 1)
    return `Non-production environments run on ${choices[0]!.name} automatically, on host ports AlphaCI picks. Production needs an HTTPS address first.`;
  return "Choose a machine for each environment now, or assign them from Hosting after creation. AlphaCI picks the host ports.";
}

function SetupHostRow({
  environment,
  index,
  choices,
  problem,
  select,
  change,
  slots,
  runtimes,
}: {
  environment: EnvironmentDraft;
  index: number;
  choices: readonly MachineSummary[];
  /** Why this environment's assignment cannot be sent yet, or null. */
  problem: string | null;
  select: (index: number, value: string) => void;
  change: ConfigChange;
  slots: readonly HostSlot[];
  runtimes?: SlotRuntimes;
}) {
  const messageId = useId();
  const binding = environment.hostAssignment;
  const single = choices.length === 1 ? choices[0]! : null;
  const value = binding ? (binding.machineId ?? AUTOMATIC) : "";
  // The problem is plain text, read with the fields it concerns; the Delivery
  // step's one live region announces that Continue is held.
  const describedBy = problem ? messageId : undefined;
  return (
    <fieldset className="wizard-machines__row">
      <legend className="wizard-machines__env">
        {environment.displayName}
      </legend>
      <div className="wizard-machines__fields">
        <label className="wizard-machines__field wizard-machines__field--full">
          <span className="sr-only">Machine</span>
          <select
            aria-describedby={describedBy}
            value={value}
            onChange={(event) => select(index, event.target.value)}
          >
            {single ? (
              <>
                <option value="">
                  {environment.role === "production"
                    ? "Assign later"
                    : `${single.name} (defaults)`}
                </option>
                <option value={AUTOMATIC}>{single.name} (configure)</option>
              </>
            ) : (
              <>
                <option value="">Assign later</option>
                {choices.map((host) => (
                  <option key={host.id} value={host.id}>
                    {host.name} · {host.status}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>
        {problem ? (
          <p
            className="wizard-field__hint wizard-field__hint--error wizard-machines__field--full"
            id={messageId}
          >
            {problem}
          </p>
        ) : null}
        <SetupAssignmentFields
          environment={environment}
          index={index}
          problemId={describedBy}
          change={change}
          slots={slots}
          runtimes={runtimes}
        />
      </div>
    </fieldset>
  );
}

function SetupAssignmentFields({
  environment,
  index,
  problemId,
  change,
  slots,
  runtimes,
}: Pick<
  Parameters<typeof SetupHostRow>[0],
  "environment" | "index" | "change" | "slots" | "runtimes"
> & { problemId?: string }) {
  const binding = environment.hostAssignment;
  if (!binding) return null;
  // The fields of an assignment that has a problem are marked invalid and read
  // the problem out with the field.
  const invalid = invalidAttributes(problemId);
  // One container port and health path per container: with two repositories
  // the host runs the backend and the frontend, so each field names its own.
  const prefix = (slot: HostSlot) =>
    slots.length > 1 ? `${SLOT_LABELS[slot]} ` : "";
  return (
    <>
      {slots.map((slot) => (
        <Fragment key={slot}>
          <label className="wizard-machines__field">
            <span className="wizard-machines__label">
              {prefix(slot)
                ? `${prefix(slot)}container port`
                : "Container port"}
            </span>
            <input
              type="number"
              min={1}
              max={65535}
              required
              {...invalid}
              value={slotContainerPort(binding.config, slot, runtimes)}
              onChange={(event) =>
                change(index, (config) =>
                  withSlotContainerPort(
                    config,
                    slot,
                    Number(event.target.value),
                  ),
                )
              }
            />
          </label>
          <label className="wizard-machines__field">
            <span className="wizard-machines__label">
              {prefix(slot) ? `${prefix(slot)}health path` : "Health path"}
            </span>
            <input
              required
              {...invalid}
              value={slotHealthPath(binding.config, slot, runtimes)}
              onChange={(event) =>
                change(index, (config) =>
                  withSlotHealthPath(config, slot, event.target.value),
                )
              }
            />
          </label>
        </Fragment>
      ))}
      {environment.role === "production" ? (
        <ProductionIngressFields
          binding={binding}
          index={index}
          problemId={problemId}
          change={change}
        />
      ) : null}
    </>
  );
}

/** The fields of an assignment that has a problem are marked invalid and read the problem out with the field. */
function invalidAttributes(problemId?: string) {
  return problemId
    ? { "aria-invalid": true, "aria-describedby": problemId }
    : {};
}

/** Production reaches the environment through an existing URL or the automatic tunnel. */
function ProductionIngressFields({
  binding,
  index,
  problemId,
  change,
}: {
  binding: NonNullable<EnvironmentDraft["hostAssignment"]>;
  index: number;
  problemId?: string;
  change: ConfigChange;
}) {
  const tunnel = binding.config.ingress.mode === "tunnel";
  return (
    <>
      <label className="wizard-machines__field wizard-machines__field--full">
        <span className="wizard-machines__label">How users reach it</span>
        <select
          value={tunnel ? "tunnel" : "configured"}
          onChange={(event) =>
            change(index, (config) => ({
              ...config,
              // A tunnel's address is created by the machine, so the mode
              // switch clears any typed URL.
              ingress:
                event.target.value === "tunnel"
                  ? { mode: "tunnel", publicUrl: null }
                  : { mode: "configured", publicUrl: config.ingress.publicUrl },
            }))
          }
        >
          <option value="configured">
            Through an existing proxy or domain
          </option>
          <option value="tunnel">Automatic HTTPS address</option>
        </select>
      </label>
      {tunnel ? (
        <p className="wizard-field__hint wizard-machines__field--full">
          AlphaCI gives this environment an HTTPS address. On a server with an apps
          domain it is permanent (for example https://myapp.apps.example.com);
          otherwise it is a tunnel address that changes when the tunnel restarts.
        </p>
      ) : (
        <label className="wizard-machines__field wizard-machines__field--full">
          <span className="wizard-machines__label">
            Configured HTTPS ingress URL
          </span>
          <input
            type="url"
            required
            {...invalidAttributes(problemId)}
            value={binding.config.ingress.publicUrl ?? ""}
            onChange={(event) =>
              change(index, (config) => ({
                ...config,
                ingress: {
                  mode: "configured",
                  publicUrl: event.target.value || null,
                },
              }))
            }
          />
        </label>
      )}
    </>
  );
}
