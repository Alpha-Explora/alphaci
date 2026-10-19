import type { DeploymentProvisioningRequest } from "../../../../../../src/shared/api/contracts";
import {
  ALWAYS_ON_TESTS,
  buildCreateProjectPayload,
} from "../../../../../../src/features/workflows/studio/model/create-project-payload";
import {
  CI_ONLY_PROVISIONING,
  ONPREM_MICROSERVICES_REASON,
  effectiveHostingChoice,
  environmentPathLine,
  environmentsCaption,
  hostedTargetSeeds,
  hostingCreateFields,
  hostingOptions,
  hostingReviewLines,
  renderVariablesBlockingFor,
  onpremSlotsForLayout,
  onpremSlotRuntimes,
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

  it("two repositories: hosted and None as for one, with no environments", () => {
    for (const choice of ["hosted", "none"] as const) {
      const payload = payloadFor(choice, { isMultiRepoShape: true, repoShapeId: "multi" });
      expect(payload.deploymentProvisioning).toEqual(
        choice === "hosted" ? hostedBackend : CI_ONLY_PROVISIONING,
      );
      expect("environments" in payload).toBe(false);
    }
  });

  it("two repositories on-prem: the environments, and an on-prem target per environment for both slots", () => {
    const result = buildCreateProjectPayload({
      ...base,
      repoName: "orders",
      isMultiRepoShape: true,
      repoShapeId: "multi",
      ...hostingCreateFields({
        choice: "onprem",
        hostedProvisioning: hostedBackend,
        environments: ENVIRONMENT_TEMPLATE,
        onpremSlots: onpremSlotsForLayout("multiRepo", "backend"),
      }),
    });
    if (!result.ok) throw new Error(result.message);
    const payload = result.payload;
    expect(payload.multiRepoConfig).toBeDefined();
    expect(payload.environments).toEqual([
      { slug: "dev", displayName: "Test", sourceBranch: "dev", role: "non_production" },
      { slug: "uat", displayName: "UAT", sourceBranch: "uat", role: "non_production" },
      { slug: "main", displayName: "Production", sourceBranch: "main", role: "production" },
    ]);
    expect(payload.deploymentProvisioning).toEqual({
      enabled: true,
      targets: ["dev", "uat", "main"].flatMap((environmentSlug) =>
        (["backend", "frontend"] as const).map((slot) => ({
          slot,
          provider: "onprem-compose",
          ownershipMode: "byo",
          environmentSlug,
        })),
      ),
    });
    expect(payload.deploymentProvisioning?.targets).toHaveLength(6);
  });

  it("on-prem sends each host assignment with exactly the slots the hosts run", () => {
    const [dev, ...rest] = ENVIRONMENT_TEMPLATE;
    const picked = {
      ...dev!,
      hostAssignment: {
        machineId: "m1",
        requestId: "r1",
        config: {
          ports: [{ slot: "backend" as const, containerPort: 4000 }],
          health: [{ slot: "backend" as const, path: "/" }],
          ingress: { mode: "direct" as const, publicUrl: null },
        },
      },
    };
    const fields = hostingCreateFields({
      choice: "onprem",
      hostedProvisioning: undefined,
      environments: [picked, ...rest],
      onpremSlots: ["backend", "frontend"],
    });
    expect(fields.environments?.[0]?.hostAssignment?.config.ports).toEqual([
      { slot: "backend", containerPort: 4000 },
      { slot: "frontend", containerPort: 3000 },
    ]);
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
    expect(values(hostingOptions({ onprem: { status: "hidden" }, layout: "single" }))).toEqual([
      { value: "hosted", disabled: false, reason: undefined },
      { value: "none", disabled: false, reason: undefined },
    ]);
    expect(values(hostingOptions({ onprem: { status: "enabled" }, layout: "single" }))).toEqual([
      { value: "hosted", disabled: false, reason: undefined },
      { value: "onprem", disabled: false, reason: undefined },
      { value: "none", disabled: false, reason: undefined },
    ]);
  });

  it("shows on-prem disabled with the server's reason when it is off", () => {
    const options = hostingOptions({
      onprem: { status: "disabled", reason: "On-prem hosts are off here." },
      layout: "single",
    });
    expect(options[1]).toEqual({
      value: "onprem",
      label: "On-prem host",
      disabled: true,
      reason: "On-prem hosts are off here.",
    });
  });

  it("offers on-prem for two repositories", () => {
    const options = hostingOptions({ onprem: { status: "enabled" }, layout: "multiRepo" });
    expect(options[1]).toEqual({ value: "onprem", label: "On-prem host", disabled: false });
  });

  it("disables on-prem for two services in one repository, and says what to use instead", () => {
    const options = hostingOptions({ onprem: { status: "enabled" }, layout: "microservices" });
    expect(options[1]).toMatchObject({ value: "onprem", disabled: true, reason: ONPREM_MICROSERVICES_REASON });
    expect(ONPREM_MICROSERVICES_REASON).toBe(
      "On-prem isn't available yet for two services in one repository. Use two repositories, or Vercel / Render.",
    );
  });

  it("keeps the server's reason when on-prem is off, whatever the layout", () => {
    const options = hostingOptions({
      onprem: { status: "disabled", reason: "Off here." },
      layout: "microservices",
    });
    expect(options[1]).toMatchObject({ disabled: true, reason: "Off here." });
  });
});

describe("onpremSlotsForLayout", () => {
  it("runs the application's one slot, or both slots for two repositories", () => {
    expect(onpremSlotsForLayout("single", "frontend")).toEqual(["frontend"]);
    expect(onpremSlotsForLayout("single", "backend")).toEqual(["backend"]);
    expect(onpremSlotsForLayout("multiRepo", "frontend")).toEqual(["backend", "frontend"]);
  });
});

describe("effectiveHostingChoice", () => {
  it("keeps an offered pick and falls back to Vercel / Render otherwise", () => {
    const enabled = hostingOptions({ onprem: { status: "enabled" }, layout: "single" });
    const unavailable = hostingOptions({ onprem: { status: "enabled" }, layout: "microservices" });
    const hidden = hostingOptions({ onprem: { status: "hidden" }, layout: "single" });
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
    expect(shape).toEqual({ layout: "single", isDualShape: false, selectedProjectKind: "frontend" });
    expect(
      hostedTargetSeeds({
        ...shape,
        repoName: "Orders Web",
        backendServiceName: "",
        frontendServiceName: "",
      }),
    ).toEqual([{ slot: "frontend", projectName: "orders-web" }]);
  });

  it("tells two repositories apart from two services in one repository", () => {
    const catalog = { selectedProjectType: null, selectedProjectTypeId: "" };
    expect(
      wizardShape({ ...catalog, isMicroservicesShape: false, isMultiRepoShape: true }),
    ).toMatchObject({ layout: "multiRepo", isDualShape: true });
    expect(
      wizardShape({ ...catalog, isMicroservicesShape: true, isMultiRepoShape: false }),
    ).toMatchObject({ layout: "microservices", isDualShape: true });
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

  it("says both repositories deploy to the host for two repositories on-prem", () => {
    expect(environmentsCaption("onprem", "multiRepo")).toBe(
      "Both repositories deploy to your on-prem host in each environment. Test deploys on every push to dev; UAT and Production receive a release only through promotion.",
    );
    expect(environmentsCaption("onprem", "single")).toBe(environmentsCaption("onprem"));
    expect(environmentsCaption("hosted", "multiRepo")).toBe(environmentsCaption("hosted"));
  });

  it("names both repositories under on-prem for two repositories", () => {
    const args = { environments: ENVIRONMENT_TEMPLATE, hostedTargets: hostedBackend.targets };
    expect(
      hostingReviewLines({ ...args, choice: "onprem", layout: "multiRepo", repoName: "Orders" }),
    ).toEqual({
      heading: "On-prem host — dev, uat, main",
      details: ["Backend repo · orders-be", "Frontend repo · orders-fe"],
    });
    expect(
      hostingReviewLines({ ...args, choice: "onprem", layout: "multiRepo", repoName: "orders-be" })
        .details,
    ).toEqual(["Backend repo · orders-be", "Frontend repo · orders-fe"]);
    expect(
      hostingReviewLines({ ...args, choice: "onprem", layout: "single", repoName: "orders" }).details,
    ).toEqual([]);
    expect(
      hostingReviewLines({ ...args, choice: "hosted", layout: "multiRepo", repoName: "orders" })
        .heading,
    ).toBe("Vercel / Render");
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

describe("onpremSlotRuntimes", () => {
  const nest = {
    id: "nestjs",
    serviceRuntime: { slot: "backend" as const, containerPort: 3000, healthPath: "/health" },
  };
  const dotnet = {
    id: "dotnet",
    serviceRuntime: { slot: "backend" as const, containerPort: 8080, healthPath: "/health" },
  };
  const next = {
    id: "nextjs",
    serviceRuntime: { slot: "frontend" as const, containerPort: 3000, healthPath: "/" },
  };
  const react = {
    id: "react",
    serviceRuntime: { slot: "frontend" as const, containerPort: 8080, healthPath: "/" },
  };
  const expo = { id: "expo" };
  const projectTypes = [nest, dotnet, next, react, expo];

  it("takes a single application's port and health path from its type", () => {
    expect(
      onpremSlotRuntimes({
        layout: "single",
        selectedProjectType: react,
        projectTypes,
        backendProjectTypeId: "nestjs",
        frontendProjectTypeId: "nextjs",
      }),
    ).toEqual({ frontend: { containerPort: 8080, healthPath: "/" } });
  });

  it("gives each repository of two its own type's contract", () => {
    expect(
      onpremSlotRuntimes({
        layout: "multiRepo",
        selectedProjectType: nest,
        projectTypes,
        backendProjectTypeId: "dotnet",
        frontendProjectTypeId: "nextjs",
      }),
    ).toEqual({
      backend: { containerPort: 8080, healthPath: "/health" },
      frontend: { containerPort: 3000, healthPath: "/" },
    });
  });

  it("leaves out a type the catalog gives no contract", () => {
    expect(
      onpremSlotRuntimes({
        layout: "single",
        selectedProjectType: expo,
        projectTypes,
        backendProjectTypeId: "",
        frontendProjectTypeId: "",
      }),
    ).toEqual({});
  });

  it("sends the contract's defaults for a slot the assignment did not cover", () => {
    const [first] = ENVIRONMENT_TEMPLATE;
    const fields = hostingCreateFields({
      choice: "onprem",
      hostedProvisioning: undefined,
      environments: [
        {
          ...first!,
          hostAssignment: {
            requestId: "r",
            config: {
              ports: [],
              health: [],
              ingress: { mode: "direct", publicUrl: null },
            },
          },
        },
      ],
      onpremSlots: ["backend"],
      onpremRuntimes: { backend: { containerPort: 8080, healthPath: "/health" } },
    });
    expect(fields.environments?.[0]?.hostAssignment?.config).toMatchObject({
      ports: [{ slot: "backend", containerPort: 8080 }],
      health: [{ slot: "backend", path: "/health" }],
    });
  });
});
