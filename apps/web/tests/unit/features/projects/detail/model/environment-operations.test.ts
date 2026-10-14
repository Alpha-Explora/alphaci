import {
  buildEnvironmentRows,
  canPromoteEnvironment,
  type DeploymentProviderSummary,
  type EnvironmentDeployment,
  type ProjectEnvironment,
  type ProjectRelease,
} from "../../../../../../src/features/projects/detail/model/environment-operations";
import type { DeploymentTarget } from "../../../../../../src/shared/api/contracts";

/**
 * Failure modes of the environment view's derivation, which the browser
 * cannot check cheaply against a real backend:
 * - environments shown out of promotion order;
 * - the current release taken from a newer failed or in-flight deployment;
 * - Promote offering a release the previous environment does not run;
 * - Promote offered while the destination already runs it or is deploying;
 * - the first environment offering Promote;
 * - one environment showing another's targets when they share a branch;
 * - host settings tied to the provider name instead of how it is delivered.
 */

const environment = (
  id: string,
  position: number,
  role: ProjectEnvironment["role"] = "non_production",
): ProjectEnvironment => ({
  id,
  slug: id,
  displayName: id.toUpperCase(),
  sourceBranch: position === 2 ? "main" : "dev",
  role,
  position,
  autoDeploy: position === 0,
});

const deployment = (
  environmentId: string,
  status: EnvironmentDeployment["status"],
  updatedAt: string,
): EnvironmentDeployment => ({
  id: environmentId + "-" + updatedAt,
  environmentId,
  releaseId: "",
  trigger: "automatic",
  targetIds: [],
  status,
  detail: null,
  createdAt: updatedAt,
  updatedAt,
});

const release = (
  id: string,
  deployments: EnvironmentDeployment[],
): ProjectRelease => ({
  releaseId: id,
  sourceEnvironmentId: "test",
  sourceBranch: "dev",
  commitSha: id.repeat(40).slice(0, 40),
  artifacts: [],
  verificationStatus: "verified",
  createdAt: "2026-09-28T00:00:00Z",
  deployments: deployments.map((item) => ({ ...item, releaseId: id })),
});

const target = (
  id: string,
  environmentId: string,
  provider: DeploymentTarget["provider"],
): DeploymentTarget => ({
  id,
  projectId: "project",
  environmentId,
  slot: "backend",
  ownershipMode: "byo",
  provider,
  providerConnectionId: null,
  providerProjectId: id,
  providerProjectName: id,
  repoFullName: "org/repo",
  branchName: "dev",
  rootDirectory: null,
  buildCommand: null,
  startCommand: null,
  environmentMap: {},
  status: "active",
});

const providers: DeploymentProviderSummary[] = [
  { id: "render", label: "Render", enabled: true, capabilities: { connectivity: "direct" } },
  {
    id: "onprem-compose",
    label: "On-prem host (Docker Compose)",
    enabled: true,
    capabilities: { connectivity: "indirect" },
  },
];

// Returned out of order on purpose.
const environments = [
  environment("prod", 2, "production"),
  environment("test", 0),
  environment("uat", 1),
];

describe("buildEnvironmentRows", () => {
  it("orders environments by position and keeps each one's own targets", () => {
    const rows = buildEnvironmentRows({
      environments,
      releases: [],
      targets: [
        target("test-api", "test", "render"),
        target("uat-api", "uat", "render"),
        target("prod-api", "prod", "onprem-compose"),
      ],
      providers,
    });

    expect(rows.map(({ environment: { id } }) => id)).toEqual(["test", "uat", "prod"]);
    expect(rows.map(({ targets }) => targets.map(({ id }) => id))).toEqual([
      ["test-api"],
      ["uat-api"],
      ["prod-api"],
    ]);
    expect(rows.map(({ hostDelivered }) => hostDelivered)).toEqual([false, false, true]);
    expect(rows[2]!.targets[0]!.providerLabel).toBe("On-prem host (Docker Compose)");
  });

  it("treats the latest healthy deployment as current, not a newer failure", () => {
    const rows = buildEnvironmentRows({
      environments,
      releases: [
        release("a", [deployment("test", "healthy", "2026-09-28T01:00:00Z")]),
        release("b", [deployment("test", "failed", "2026-09-28T02:00:00Z")]),
      ],
      targets: [],
      providers,
    });

    expect(rows[0]!.current?.release.releaseId).toBe("a");
    expect(rows[0]!.history.map(({ release: { releaseId } }) => releaseId)).toEqual([
      "b",
      "a",
    ]);
  });

  it("offers the release the previous environment runs, and only to the next one", () => {
    const rows = buildEnvironmentRows({
      environments,
      releases: [
        release("a", [deployment("test", "healthy", "2026-09-28T01:00:00Z")]),
        // Newer, but test never ran it healthily.
        release("b", [deployment("test", "deploying", "2026-09-28T02:00:00Z")]),
      ],
      targets: [],
      providers,
    });

    expect(rows[0]!.promotion).toEqual({ kind: "automatic" });
    expect(rows[1]!.promotion).toMatchObject({
      kind: "available",
      release: { releaseId: "a" },
      from: { id: "test" },
    });
    expect(rows[2]!.promotion).toEqual({
      kind: "unavailable",
      reason: "UAT runs no release yet.",
    });
  });

  it("offers nothing while the destination deploys or already runs the release", () => {
    const rows = buildEnvironmentRows({
      environments,
      releases: [
        release("a", [
          deployment("test", "healthy", "2026-09-28T01:00:00Z"),
          deployment("uat", "healthy", "2026-09-28T02:00:00Z"),
          deployment("prod", "pending", "2026-09-28T03:00:00Z"),
        ]),
      ],
      targets: [],
      providers,
    });

    expect(rows[1]!.promotion).toMatchObject({ kind: "unavailable" });
    expect(rows[2]!.promotion).toEqual({
      kind: "unavailable",
      reason: "A deployment is in progress.",
    });
  });
});

describe("canPromoteEnvironment", () => {
  it("allows all hosting managers and developers outside production only", () => {
    expect(canPromoteEnvironment("admin", true)).toBe(true);
    expect(canPromoteEnvironment("lead", true)).toBe(true);
    expect(canPromoteEnvironment("member", false)).toBe(true);
    expect(canPromoteEnvironment("member", true)).toBe(false);
    expect(canPromoteEnvironment("qa", false)).toBe(false);
    expect(canPromoteEnvironment(undefined, false)).toBe(false);
  });
});
