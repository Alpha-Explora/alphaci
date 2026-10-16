"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { healthyHosts, type MachineSummary } from "@/features/hosts";
import type { EnvironmentDraft } from "../model/project-environments-rules";
import { defaultHostAssignment } from "../model/setup-host-assignment-rules";
import { useSetupHostSelection } from "../view-models/use-setup-host-selection";

/** Select value for the workspace's only connected machine, chosen by the server. */
const AUTOMATIC = "automatic";

export function SetupHostSelection({
  environments,
  onChange,
  slot,
}: {
  environments: readonly EnvironmentDraft[];
  onChange: (value: EnvironmentDraft[]) => void;
  slot: "frontend" | "backend";
}) {
  const vm = useSetupHostSelection();
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
  function change(
    index: number,
    field: "containerPort" | "health" | "ingress",
    value: string,
  ) {
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
    return `Non-production environments run on ${choices[0]!.name} automatically, on host ports AlphaCI picks. Production needs its HTTPS ingress URL first.`;
  return "Choose a machine for each environment now, or assign them from Hosting after creation. AlphaCI picks the host ports.";
}

function SetupHostRow({
  environment,
  index,
  choices,
  select,
  change,
}: {
  environment: EnvironmentDraft;
  index: number;
  choices: readonly MachineSummary[];
  select: (index: number, value: string) => void;
  change: (
    index: number,
    field: "containerPort" | "health" | "ingress",
    value: string,
  ) => void;
}) {
  const binding = environment.hostAssignment;
  const single = choices.length === 1 ? choices[0]! : null;
  const value = binding ? (binding.machineId ?? AUTOMATIC) : "";
  return (
    <fieldset>
      <legend>{environment.displayName}</legend>
      <label>
        Machine{" "}
        <select
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
      <SetupAssignmentFields
        environment={environment}
        index={index}
        change={change}
      />
    </fieldset>
  );
}

function SetupAssignmentFields({
  environment,
  index,
  change,
}: Pick<
  Parameters<typeof SetupHostRow>[0],
  "environment" | "index" | "change"
>) {
  const binding = environment.hostAssignment;
  if (!binding) return null;
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
          value={binding.config.health[0]?.path ?? ""}
          onChange={(event) => change(index, "health", event.target.value)}
        />
      </label>
      {environment.role === "production" ? (
        <label>
          Configured HTTPS ingress URL{" "}
          <input
            type="url"
            required
            value={binding.config.ingress.publicUrl ?? ""}
            onChange={(event) => change(index, "ingress", event.target.value)}
          />
        </label>
      ) : null}
    </>
  );
}
