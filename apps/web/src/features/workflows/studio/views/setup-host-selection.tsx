"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { EnvironmentDraft } from "../model/project-environments-rules";
import { useSetupHostSelection } from "../view-models/use-setup-host-selection";
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
  function select(index: number, machineId: string) {
    onChange(
      environments.map((environment, position) => {
        if (position !== index) return environment;
        const rest = { ...environment };
        delete rest.hostAssignment;
        return machineId
          ? {
              ...rest,
              hostAssignment: {
                machineId,
                requestId: crypto.randomUUID(),
                config: {
                  ports: [
                    {
                      slot,
                      hostPort: 8080 + index,
                      containerPort: slot === "frontend" ? 3000 : 4000,
                    },
                  ],
                  health: [{ slot, path: "/" }],
                  ingress: {
                    mode:
                      environment.role === "production"
                        ? "configured"
                        : "direct",
                    publicUrl: null,
                  },
                },
              },
            }
          : rest;
      }),
    );
  }
  function change(
    index: number,
    field: "hostPort" | "containerPort" | "health" | "ingress",
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
                      ports: [{ ...config.ports[0], [field]: Number(value) }],
                    },
          },
        };
      }),
    );
  }
  return (
    <section aria-label="Choose on-prem machines">
      <h4>Machines</h4>
      <p>
        Choose now, or assign them from Hosting after creation. Use different
        host ports for each environment.
      </p>
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
      {environments.map((environment, index) => (
        <SetupHostRow
          key={environment.slug}
          environment={environment}
          index={index}
          hosts={vm.hosts}
          select={select}
          change={change}
        />
      ))}
    </section>
  );
}

function SetupHostRow({
  environment,
  index,
  hosts,
  select,
  change,
}: {
  environment: EnvironmentDraft;
  index: number;
  hosts: ReturnType<typeof useSetupHostSelection>["hosts"];
  select: (index: number, machineId: string) => void;
  change: (
    index: number,
    field: "hostPort" | "containerPort" | "health" | "ingress",
    value: string,
  ) => void;
}) {
  return (
    <fieldset>
      <legend>{environment.displayName}</legend>
      <label>
        Machine{" "}
        <select
          value={environment.hostAssignment?.machineId ?? ""}
          onChange={(event) => select(index, event.target.value)}
        >
          <option value="">Assign later</option>
          {hosts.map((host) => (
            <option key={host.id} value={host.id}>
              {host.name} · {host.status}
            </option>
          ))}{" "}
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
  return (
    <>
      {" "}
      {environment.hostAssignment ? (
        <>
          <label>
            Host port{" "}
            <input
              type="number"
              min={1}
              max={65535}
              required
              value={
                environment.hostAssignment.config.ports[0]?.hostPort ??
                8080 + index
              }
              onChange={(event) =>
                change(index, "hostPort", event.target.value)
              }
            />
          </label>
          <label>
            Container port{" "}
            <input
              type="number"
              min={1}
              max={65535}
              required
              value={
                environment.hostAssignment.config.ports[0]?.containerPort ??
                3000
              }
              onChange={(event) =>
                change(index, "containerPort", event.target.value)
              }
            />
          </label>
          <label>
            Health path{" "}
            <input
              required
              value={environment.hostAssignment.config.health[0]?.path ?? ""}
              onChange={(event) => change(index, "health", event.target.value)}
            />
          </label>
          {environment.role === "production" ? (
            <label>
              Configured HTTPS ingress URL{" "}
              <input
                type="url"
                required
                value={
                  environment.hostAssignment.config.ingress.publicUrl ?? ""
                }
                onChange={(event) =>
                  change(index, "ingress", event.target.value)
                }
              />
            </label>
          ) : null}
        </>
      ) : null}
    </>
  );
}
