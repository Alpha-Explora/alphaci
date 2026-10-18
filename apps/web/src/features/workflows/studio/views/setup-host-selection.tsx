"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { healthyHosts, type MachineSummary } from "@/features/hosts";
import type { EnvironmentDraft } from "../model/project-environments-rules";
import { defaultHostAssignment } from "../model/setup-host-assignment-rules";
import type { useSetupHostSelection } from "../view-models/use-setup-host-selection";

/** Select value for the workspace's only connected machine, chosen by the server. */
const AUTOMATIC = "automatic";

/** The per-environment fields a change can write. */
type HostField = "containerPort" | "health" | "ingress" | "ingressMode";

export function SetupHostSelection({
  environments,
  hostProblems,
  hostSelection: vm,
  onChange,
  slot,
}: {
  environments: readonly EnvironmentDraft[];
  /** Each environment's problem, or null; computed once by the wizard. */
  hostProblems: readonly (string | null)[];
  hostSelection: ReturnType<typeof useSetupHostSelection>;
  onChange: (value: EnvironmentDraft[]) => void;
  slot: "frontend" | "backend";
}) {
  const workspace = useRef(vm.workspaceId);
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
            slot,
            value === AUTOMATIC ? undefined : value,
          ),
        };
      }),
    );
  }
  function change(index: number, field: HostField, value: string) {
    onChange(
      environments.map((environment, position) => {
        if (index !== position || !environment.hostAssignment)
          return environment;
        const binding = environment.hostAssignment,
          config = binding.config;
        return {
          ...environment,
          hostAssignment: {
            ...binding,
            config:
              field === "ingress"
                ? {
                    ...config,
                    ingress: { mode: "configured", publicUrl: value || null },
                  }
                : field === "ingressMode"
                  ? {
                      ...config,
                      // A tunnel's address is created by the machine, so the
                      // mode switch clears any typed URL.
                      ingress:
                        value === "tunnel"
                          ? { mode: "tunnel", publicUrl: null }
                          : {
                              mode: "configured",
                              publicUrl: config.ingress.publicUrl,
                            },
                    }
                  : field === "health"
                    ? { ...config, health: [{ slot, path: value || null }] }
                    : {
                        ...config,
                        ports: [
                          { ...config.ports[0]!, containerPort: Number(value) },
                        ],
                      },
          },
        };
      }),
    );
  }
  return (
    <section aria-label="Choose on-prem machines">
      <h4>Machines</h4>
      <p>{setupHostIntro(choices)}</p>
      {vm.error ? <p role="status">{vm.error}</p> : null}
      <Link
        target="_blank"
        href={`/hosts${vm.workspaceId ? `?workspace=${encodeURIComponent(vm.workspaceId)}` : ""}`}
      >
        Add a host
      </Link>
      <button type="button" className="ghost-button" onClick={vm.refresh}>
        Refresh hosts
      </button>
      {choices.length
        ? environments.map((environment, index) => (
            <SetupHostRow
              key={environment.slug}
              environment={environment}
              index={index}
              choices={choices}
              problem={hostProblems[index] ?? null}
              select={select}
              change={change}
            />
          ))
        : null}
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
}: {
  environment: EnvironmentDraft;
  index: number;
  choices: readonly MachineSummary[];
  /** Why this environment's assignment cannot be sent yet, or null. */
  problem: string | null;
  select: (index: number, value: string) => void;
  change: (index: number, field: HostField, value: string) => void;
}) {
  const messageId = useId();
  const binding = environment.hostAssignment;
  const single = choices.length === 1 ? choices[0]! : null;
  const value = binding ? (binding.machineId ?? AUTOMATIC) : "";
  // The problem is plain text, read with the fields it concerns; the Delivery
  // step's one live region announces that Continue is held.
  const describedBy = problem ? messageId : undefined;
  return (
    <fieldset>
      <legend>{environment.displayName}</legend>
      <label>
        Machine{" "}
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
        <p className="wizard-field__hint wizard-field__hint--error" id={messageId}>
          {problem}
        </p>
      ) : null}
      <SetupAssignmentFields
        environment={environment}
        index={index}
        problemId={describedBy}
        change={change}
      />
    </fieldset>
  );
}

function SetupAssignmentFields({
  environment,
  index,
  problemId,
  change,
}: Pick<
  Parameters<typeof SetupHostRow>[0],
  "environment" | "index" | "change"
> & { problemId?: string }) {
  const binding = environment.hostAssignment;
  if (!binding) return null;
  // The fields of an assignment that has a problem are marked invalid and read
  // the problem out with the field.
  const invalid = invalidAttributes(problemId);
  return (
    <>
      {" "}
      <label>
        Container port{" "}
        <input
          type="number"
          min={1}
          max={65535}
          required
          {...invalid}
          value={binding.config.ports[0]?.containerPort ?? 3000}
          onChange={(event) =>
            change(index, "containerPort", event.target.value)
          }
        />
      </label>
      <label>
        Health path{" "}
        <input
          required
          {...invalid}
          value={binding.config.health[0]?.path ?? ""}
          onChange={(event) => change(index, "health", event.target.value)}
        />
      </label>
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
  change: (index: number, field: HostField, value: string) => void;
}) {
  const tunnel = binding.config.ingress.mode === "tunnel";
  return (
    <>
      <label>
        How users reach it{" "}
        <select
          value={tunnel ? "tunnel" : "configured"}
          onChange={(event) => change(index, "ingressMode", event.target.value)}
        >
          <option value="configured">
            Through an existing proxy or domain
          </option>
          <option value="tunnel">Automatic HTTPS address (tunnel)</option>
        </select>
      </label>
      {tunnel ? (
        <p className="wizard-field__hint">
          The machine creates this HTTPS address. It changes whenever the tunnel
          restarts; a named domain is the production upgrade.
        </p>
      ) : (
        <label>
          Configured HTTPS ingress URL{" "}
          <input
            type="url"
            required
            {...invalidAttributes(problemId)}
            value={binding.config.ingress.publicUrl ?? ""}
            onChange={(event) => change(index, "ingress", event.target.value)}
          />
        </label>
      )}
    </>
  );
}
