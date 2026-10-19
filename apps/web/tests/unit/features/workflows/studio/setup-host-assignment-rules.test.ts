import {
  defaultHostAssignment,
  fitHostAssignments,
  setupHostAssignmentsProblem,
  withSlotContainerPort,
  withSlotHealthPath,
} from "@/features/workflows/studio/model/setup-host-assignment-rules";
import { setupHostIntro } from "@/features/workflows/studio/views/setup-host-selection";
import type { EnvironmentDraft } from "@/features/workflows/studio/model/project-environments-rules";
import type { MachineSummary } from "@/features/hosts";

const test: EnvironmentDraft = {
  slug: "dev",
  displayName: "Test",
  sourceBranch: "dev",
  role: "non_production",
  runsOn: "onprem",
};
const machine = (name: string): MachineSummary => ({
  id: name,
  workspaceId: "workspace",
  name,
  platform: "ubuntu",
  agentVersion: "0.1.0",
  lastSeenAt: new Date().toISOString(),
  status: "connected",
  checks: [],
});

it("leaves the machine to the server and never sends a host port", () => {
  const binding = defaultHostAssignment(test, ["frontend"]);
  expect(binding).not.toHaveProperty("machineId");
  expect(binding.config.ports).toEqual([
    { slot: "frontend", containerPort: 3000 },
  ]);
  expect(defaultHostAssignment(test, ["backend"], "m1").machineId).toBe("m1");
});

it("lets environments share a machine without choosing host ports", () => {
  const environments = [
    { ...test, hostAssignment: defaultHostAssignment(test, ["frontend"]) },
    {
      ...test,
      slug: "uat",
      hostAssignment: defaultHostAssignment(test, ["frontend"]),
    },
  ];
  expect(setupHostAssignmentsProblem(environments)).toBeNull();
  const broken = defaultHostAssignment(test, ["frontend"]);
  broken.config.ports[0]!.containerPort = 0;
  expect(
    setupHostAssignmentsProblem([{ ...test, hostAssignment: broken }]),
  ).toMatch(/container port/);
});

it("still requires production ingress when production is assigned now", () => {
  const production: EnvironmentDraft = { ...test, role: "production" };
  expect(
    setupHostAssignmentsProblem([
      {
        ...production,
        hostAssignment: defaultHostAssignment(production, ["frontend"]),
      },
    ]),
  ).toMatch(/HTTPS URL/);
});

it("explains when a machine choice is needed", () => {
  expect(setupHostIntro([])).toMatch(/No machine is connected/);
  expect(setupHostIntro([machine("rack-1")])).toMatch(
    /run on rack-1 automatically/,
  );
  expect(setupHostIntro([machine("a"), machine("b")])).toMatch(
    /Choose a machine/,
  );
});

it("gives two repositories one port and one health path per slot", () => {
  const binding = defaultHostAssignment(test, ["backend", "frontend"]);
  expect(binding.config.ports).toEqual([
    { slot: "backend", containerPort: 4000 },
    { slot: "frontend", containerPort: 3000 },
  ]);
  expect(binding.config.health).toEqual([
    { slot: "backend", path: "/" },
    { slot: "frontend", path: "/" },
  ]);
  const edited = withSlotHealthPath(
    withSlotContainerPort(binding.config, "frontend", 8080),
    "backend",
    "/healthz",
  );
  expect(edited.ports).toEqual([
    { slot: "backend", containerPort: 4000 },
    { slot: "frontend", containerPort: 8080 },
  ]);
  expect(edited.health).toEqual([
    { slot: "backend", path: "/healthz" },
    { slot: "frontend", path: "/" },
  ]);
});

it("fits an assignment picked before the shape changed to the slots now deployed", () => {
  const picked = defaultHostAssignment(test, ["frontend"], "m1");
  picked.config.ports[0]!.containerPort = 5173;
  const [toTwo] = fitHostAssignments([{ ...test, hostAssignment: picked }], [
    "backend",
    "frontend",
  ]);
  expect(toTwo!.hostAssignment).toMatchObject({
    machineId: "m1",
    config: {
      ports: [
        { slot: "backend", containerPort: 4000 },
        { slot: "frontend", containerPort: 5173 },
      ],
      health: [
        { slot: "backend", path: "/" },
        { slot: "frontend", path: "/" },
      ],
    },
  });
  const [backToOne] = fitHostAssignments([toTwo!], ["frontend"]);
  expect(backToOne!.hostAssignment!.config.ports).toEqual([
    { slot: "frontend", containerPort: 5173 },
  ]);
  expect(fitHostAssignments([test], ["backend"])).toEqual([test]);
});
