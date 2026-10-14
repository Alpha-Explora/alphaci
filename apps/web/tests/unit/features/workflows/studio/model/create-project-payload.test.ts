import type { DeploymentProvisioningRequest } from "../../../../../../src/shared/api/contracts";
import { buildCreateProjectPayload } from "../../../../../../src/features/workflows/studio/model/create-project-payload";
import {
  runEveryEnvironmentOnprem,
  setEnvironmentRunsOn,
} from "../../../../../../src/features/workflows/studio/model/onprem-hosting-rules";
import {
  ENVIRONMENT_TEMPLATE,
  type EnvironmentDraft,
} from "../../../../../../src/features/workflows/studio/model/project-environments-rules";

/**
 * The create request with each environment's "Runs on":
 * - every environment on-prem: on-prem targets only, no Render or Vercel;
 * - some on-prem: the hosted targets stay, each on-prem environment gets its own;
 * - none on-prem: the request is byte for byte what it was before on-prem.
 */

const hostedBackend: DeploymentProvisioningRequest = {
  enabled: true,
  targets: [
    {
      slot: "backend",
      provider: "render",
      ownershipMode: "flowci_managed",
      projectName: "ledger",
      branchName: "uat",
      rootDirectory: ".",
      buildCommand: "npm ci && npm run build",
      startCommand: "npm run start:prod",
      renderDeployMethod: "native_git",
      renderServiceType: "web_service",
      renderRuntime: "docker",
      renderInstanceType: "free",
      env: [],
    },
  ],
};

/** A single-repository .NET API, as the wizard hands it to the builder. */
const input = {
  projectName: "Ledger",
  repoName: "ledger",
  visibility: "private" as const,
  serviceName: "ledger",
  servicePath: ".",
  nodeVersion: "24",
  coverageThreshold: "80",
  outputFileName: "ci.yml",
  backendProjectTypeId: "nestjs",
  backendWorkflowRecipeId: "standard",
  backendServiceName: "",
  backendServicePath: "backend/",
  frontendProjectTypeId: "nextjs",
  frontendWorkflowRecipeId: "standard",
  frontendServiceName: "",
  frontendServicePath: "frontend/",
  isMicroservicesShape: false,
  isMultiRepoShape: false,
  repoShapeId: "standalone",
  projectTypeId: "dotnet",
  workflowRecipeId: "standard",
  tests: { lint: true, unit: true, build: true, coverage: true, security: true, docker: true },
  deploymentProvisioning: hostedBackend,
};

const sentEnvironments = [
  { slug: "dev", displayName: "Test", sourceBranch: "dev", role: "non_production" },
  { slug: "uat", displayName: "UAT", sourceBranch: "uat", role: "non_production" },
  { slug: "main", displayName: "Production", sourceBranch: "main", role: "production" },
];

function payloadOf(result: ReturnType<typeof buildCreateProjectPayload>) {
  if (!result.ok) throw new Error(result.message);
  return result.payload;
}

describe("buildCreateProjectPayload with on-prem environments", () => {
  it("sends only on-prem targets when every environment runs on-prem", () => {
    const payload = payloadOf(
      buildCreateProjectPayload({
        ...input,
        environments: runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE),
        onpremSlots: ["backend"],
      }),
    );
    expect(payload.deploymentProvisioning).toEqual({
      enabled: true,
      targets: ["dev", "uat", "main"].map((environmentSlug) => ({
        slot: "backend",
        provider: "onprem-compose",
        ownershipMode: "byo",
        environmentSlug,
      })),
    });
    // The choice is not an environment field.
    expect(payload.environments).toEqual(sentEnvironments);
  });

  it("keeps the hosted targets and adds the on-prem environments' own when mixed", () => {
    const payload = payloadOf(
      buildCreateProjectPayload({
        ...input,
        environments: setEnvironmentRunsOn(ENVIRONMENT_TEMPLATE, 2, "onprem"),
        onpremSlots: ["backend"],
      }),
    );
    expect(payload.deploymentProvisioning).toEqual({
      enabled: true,
      targets: [
        hostedBackend.targets[0],
        {
          slot: "backend",
          provider: "onprem-compose",
          ownershipMode: "byo",
          environmentSlug: "main",
        },
      ],
    });
    expect(payload.environments).toEqual(sentEnvironments);
  });

  it("is byte for byte today's request when no environment is on-prem", () => {
    const managedRows: EnvironmentDraft[] = setEnvironmentRunsOn(
      ENVIRONMENT_TEMPLATE,
      0,
      "managed",
    );
    const today = JSON.stringify(
      payloadOf(buildCreateProjectPayload({ ...input, environments: ENVIRONMENT_TEMPLATE })),
    );
    for (const environments of [ENVIRONMENT_TEMPLATE, managedRows]) {
      expect(
        JSON.stringify(
          payloadOf(
            buildCreateProjectPayload({ ...input, environments, onpremSlots: ["backend"] }),
          ),
        ),
      ).toBe(today);
    }
    // ...and today's request, written out, so a change to the builder itself shows here.
    expect(today).toBe(
      JSON.stringify({
        projectName: "Ledger",
        repoName: "ledger",
        visibility: "private",
        repoShape: "standalone",
        nodeVersion: "24",
        coverageThreshold: 80,
        tests: input.tests,
        outputFileName: "ci.yml",
        deploymentProvisioning: hostedBackend,
        projectTypeId: "dotnet",
        workflowRecipeId: "standard",
        serviceName: "ledger",
        servicePath: ".",
        environments: sentEnvironments,
      }),
    );
  });

  it("ignores Runs on when the deployment does not offer on-prem", () => {
    const withoutOnprem = { ...input, environments: runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE) };
    const payload = payloadOf(buildCreateProjectPayload(withoutOnprem));
    expect(payload.deploymentProvisioning).toBe(hostedBackend);
    expect(payload.environments).toEqual(sentEnvironments);
  });

  it("sends nothing new for shapes without their own environments", () => {
    const payload = payloadOf(
      buildCreateProjectPayload({
        ...input,
        isMicroservicesShape: true,
        environments: runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE),
        onpremSlots: ["backend"],
      }),
    );
    expect(payload.deploymentProvisioning).toBe(hostedBackend);
    expect("environments" in payload).toBe(false);
  });
});
