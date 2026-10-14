import type { DeploymentProvisioningRequest } from "../../../../../../src/shared/api/contracts";
import {
  ALWAYS_ON_TESTS,
  buildCreateProjectPayload,
} from "../../../../../../src/features/workflows/studio/model/create-project-payload";
import {
  CI_ONLY_PROVISIONING,
  ONPREM_SINGLE_APP_ONLY_REASON,
  effectiveHostingChoice,
  environmentPathLine,
  environmentsCaption,
  hostedTargetSeeds,
  hostingCreateFields,
  hostingOptions,
  hostingReviewLines,
  renderVariablesBlockingFor,
  wizardShape,
  type HostingChoice,
} from "../../../../../../src/features/workflows/studio/model/hosting-choice-rules";
import { ENVIRONMENT_TEMPLATE } from "../../../../../../src/features/workflows/studio/model/project-environments-rules";

/**
 * The create wizard's one Hosting choice, end to end through the payload
 * builder: Vercel / Render keeps today's targets and sends no environments,
 * on-prem sends the fixed environments with on-prem targets only, and None
 * sends an explicit "no hosting".
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
      env: [{ lane: "preview", vars: [{ key: "DATABASE_URL", value: "postgres://x" }] }],
    },
  ],
};

/** A single-repository API, as the wizard hands it to the builder. */
const base = {
  projectName: "Ledger",
  repoName: "Ledger.Api",
  visibility: "private" as const,
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
  projectTypeId: "nestjs-api",
  workflowRecipeId: "standard",
  tests: ALWAYS_ON_TESTS,
};

function payloadFor(choice: HostingChoice, overrides: Partial<typeof base> = {}) {
  const result = buildCreateProjectPayload({
    ...base,
    ...overrides,
    ...hostingCreateFields({
      choice,
      hostedProvisioning: hostedBackend,
      environments: ENVIRONMENT_TEMPLATE,
      onpremSlots: ["backend"],
    }),
  });
  if (!result.ok) throw new Error(result.message);
  return result.payload as typeof result.payload & { environments?: unknown };
}

describe("hostingCreateFields through buildCreateProjectPayload", () => {
  it("Vercel / Render: today's hosted targets, no environments", () => {
    const payload = payloadFor("hosted");
    expect(payload.deploymentProvisioning).toBe(hostedBackend);
    expect("environments" in payload).toBe(false);
  });

  it("on-prem: the fixed environments, each with its own on-prem target, nothing hosted", () => {
    const payload = payloadFor("onprem");
    expect(payload.environments).toEqual([
      { slug: "dev", displayName: "Test", sourceBranch: "dev", role: "non_production" },
      { slug: "uat", displayName: "UAT", sourceBranch: "uat", role: "non_production" },
      { slug: "main", displayName: "Production", sourceBranch: "main", role: "production" },
    ]);
    expect(payload.deploymentProvisioning).toEqual({
      enabled: true,
      targets: ["dev", "uat", "main"].map((environmentSlug) => ({
        slot: "backend",
        provider: "onprem-compose",
        ownershipMode: "byo",
        environmentSlug,
      })),
    });
  });

  it("None: an explicit no-hosting request and no environments", () => {
    const payload = payloadFor("none");
    expect(payload.deploymentProvisioning).toEqual({ enabled: false, targets: [] });
    expect(payload.deploymentProvisioning).toBe(CI_ONLY_PROVISIONING);
    expect("environments" in payload).toBe(false);
  });

  it("two repositories: hosted and None as for one, and never any environments", () => {
    for (const choice of ["hosted", "none"] as const) {
      const payload = payloadFor(choice, { isMultiRepoShape: true, repoShapeId: "multi" });
      expect(payload.deploymentProvisioning).toEqual(
        choice === "hosted" ? hostedBackend : CI_ONLY_PROVISIONING,
      );
      expect("environments" in payload).toBe(false);
    }
  });

  it("hosted without provisioning on the deployment sends nothing (the backend default)", () => {
    expect(
      hostingCreateFields({
        choice: "hosted",
        hostedProvisioning: undefined,
        environments: ENVIRONMENT_TEMPLATE,
        onpremSlots: ["backend"],
      }),
    ).toEqual({ deploymentProvisioning: undefined });
  });

  it("names the service after the repository, at its root, whatever the choice", () => {
    for (const choice of ["hosted", "onprem", "none"] as const) {
      const payload = payloadFor(choice);
      expect(payload.serviceName).toBe("ledgerapi");
      expect(payload.servicePath).toBe(".");
      expect(payload.repoName).toBe("ledger.api");
    }
  });

  it("sends every workflow option on, Docker included", () => {
    expect(payloadFor("hosted").tests).toEqual({
      lint: true,
      unit: true,
      build: true,
      coverage: true,
      security: true,
      docker: true,
    });
  });
});

describe("hostingOptions", () => {
  const values = (options: ReturnType<typeof hostingOptions>) =>
    options.map(({ value, disabled, reason }) => ({ value, disabled, reason }));

  it("offers on-prem only where the deployment lists it", () => {
    expect(values(hostingOptions({ onprem: { status: "hidden" }, isDualShape: false }))).toEqual([
      { value: "hosted", disabled: false, reason: undefined },
      { value: "none", disabled: false, reason: undefined },
    ]);
    expect(values(hostingOptions({ onprem: { status: "enabled" }, isDualShape: false }))).toEqual([
      { value: "hosted", disabled: false, reason: undefined },
      { value: "onprem", disabled: false, reason: undefined },
      { value: "none", disabled: false, reason: undefined },
    ]);
  });

  it("shows on-prem disabled with the server's reason when it is off", () => {
    const options = hostingOptions({
      onprem: { status: "disabled", reason: "On-prem hosts are off here." },
      isDualShape: false,
    });
    expect(options[1]).toEqual({
      value: "onprem",
      label: "On-prem host",
      disabled: true,
      reason: "On-prem hosts are off here.",
    });
  });

  it("disables on-prem for the two-repository shape", () => {
    const options = hostingOptions({ onprem: { status: "enabled" }, isDualShape: true });
    expect(options[1]).toMatchObject({ value: "onprem", disabled: true, reason: ONPREM_SINGLE_APP_ONLY_REASON });
    expect(ONPREM_SINGLE_APP_ONLY_REASON).toBe(
      "On-prem is available for single-application projects for now.",
    );
  });
});

describe("effectiveHostingChoice", () => {
  it("keeps an offered pick and falls back to Vercel / Render otherwise", () => {
    const enabled = hostingOptions({ onprem: { status: "enabled" }, isDualShape: false });
    const unavailable = hostingOptions({ onprem: { status: "enabled" }, isDualShape: true });
    const hidden = hostingOptions({ onprem: { status: "hidden" }, isDualShape: false });
    expect(effectiveHostingChoice("onprem", enabled)).toBe("onprem");
    expect(effectiveHostingChoice("onprem", unavailable)).toBe("hosted");
    expect(effectiveHostingChoice("onprem", hidden)).toBe("hosted");
    expect(effectiveHostingChoice("none", hidden)).toBe("none");
  });
});

describe("renderVariablesBlockingFor", () => {
  it("holds only for Vercel / Render on a deployment that provisions", () => {
    expect(renderVariablesBlockingFor({ choice: "hosted", provisioningOffered: true, missing: true })).toBe(true);
    expect(renderVariablesBlockingFor({ choice: "hosted", provisioningOffered: true, missing: false })).toBe(false);
    expect(renderVariablesBlockingFor({ choice: "hosted", provisioningOffered: false, missing: true })).toBe(false);
    expect(renderVariablesBlockingFor({ choice: "onprem", provisioningOffered: true, missing: true })).toBe(false);
    expect(renderVariablesBlockingFor({ choice: "none", provisioningOffered: true, missing: true })).toBe(false);
  });
});

describe("hostedTargetSeeds and wizardShape", () => {
  it("seeds one target for a single application, named after the repository", () => {
    const shape = wizardShape({
      isMicroservicesShape: false,
      isMultiRepoShape: false,
      selectedProjectType: { kind: "frontend" },
      selectedProjectTypeId: "nextjs-app",
    });
    expect(shape).toEqual({ isDualShape: false, selectedProjectKind: "frontend" });
    expect(
      hostedTargetSeeds({
        ...shape,
        repoName: "Orders Web",
        backendServiceName: "",
        frontendServiceName: "",
      }),
    ).toEqual([{ slot: "frontend", projectName: "orders-web" }]);
  });

  it("seeds a backend and a frontend for two services", () => {
    expect(
      hostedTargetSeeds({
        isDualShape: true,
        selectedProjectKind: "backend",
        repoName: "orders",
        backendServiceName: "orders-backend",
        frontendServiceName: "orders-frontend",
      }),
    ).toEqual([
      { slot: "backend", projectName: "orders-backend" },
      { slot: "frontend", projectName: "orders-frontend" },
    ]);
  });
});

describe("the read-only environments and the Review lines", () => {
  it("reads dev → uat → main, with a caption per choice", () => {
    expect(environmentPathLine(ENVIRONMENT_TEMPLATE)).toBe("dev → uat → main");
    expect(environmentsCaption("onprem")).toContain("Each runs on your on-prem host.");
    expect(environmentsCaption("hosted")).toBe(
      "dev runs the checks on every push; uat and main are deployed when changes are promoted.",
    );
    expect(environmentsCaption("none")).toContain("Nothing is deployed.");
  });

  it("summarises each choice for Review", () => {
    const args = { environments: ENVIRONMENT_TEMPLATE, hostedTargets: hostedBackend.targets };
    expect(hostingReviewLines({ ...args, choice: "hosted" })).toEqual({
      heading: "Vercel / Render",
      details: ["Render · ledger (backend)"],
    });
    expect(hostingReviewLines({ ...args, choice: "onprem" })).toEqual({
      heading: "On-prem host — dev, uat, main",
      details: [],
    });
    expect(hostingReviewLines({ ...args, choice: "none" })).toEqual({
      heading: "None — CI workflow only",
      details: [],
    });
  });
});
