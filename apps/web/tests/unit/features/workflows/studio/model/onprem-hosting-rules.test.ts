import type { DeploymentProvisioningRequest } from "../../../../../../src/shared/api/contracts";
import {
  ALL_ONPREM_DELIVERY_NOTICE,
  ONPREM_DISABLED_FALLBACK_REASON,
  deployableSlots,
  environmentHosting,
  environmentsRunOnSummary,
  hostingDeliveryLabel,
  mixedHostingLine,
  onpremHostingFrom,
  onpremSlotsFor,
  renderVariablesBlocking,
  runEveryEnvironmentOnprem,
  setEnvironmentRunsOn,
  withOnpremTargets,
} from "../../../../../../src/features/workflows/studio/model/onprem-hosting-rules";
import {
  ENVIRONMENT_TEMPLATE,
  moveEnvironment,
  removeEnvironment,
  type EnvironmentDraft,
} from "../../../../../../src/features/workflows/studio/model/project-environments-rules";

/**
 * Failure modes of the on-prem choice in the create wizard:
 * - offered where the backend does not list it, or hidden where it is off
 *   with a reason the user should see;
 * - an environment sent with both on-prem and hosted targets (a 400);
 * - an all-on-prem project left with the backend's default Render target;
 * - a project with no on-prem environment sending anything new;
 * - the Render-variable rule blocking a project with no Render service.
 */

const hostedBackend: DeploymentProvisioningRequest = {
  enabled: true,
  targets: [
    {
      slot: "backend",
      provider: "render",
      ownershipMode: "flowci_managed",
      projectName: "orders",
      branchName: "uat",
      env: [],
    },
  ],
};

function hostingOf(
  environments: readonly EnvironmentDraft[],
  overrides: Partial<Parameters<typeof environmentHosting>[0]> = {},
) {
  return environmentHosting({
    environments,
    environmentsEnabled: true,
    isMicroservicesShape: false,
    isMultiRepoShape: false,
    onpremStatus: "enabled",
    ...overrides,
  });
}

describe("onpremHostingFrom", () => {
  it("offers on-prem only when the backend lists it enabled", () => {
    expect(
      onpremHostingFrom([
        { id: "render", enabled: true },
        { id: "onprem-compose", enabled: true, supportedSlots: ["backend"] },
      ]),
    ).toEqual({ status: "enabled" });
  });

  it("is disabled with the server's reason, or a fallback sentence", () => {
    expect(
      onpremHostingFrom([
        { id: "onprem-compose", enabled: false, reason: "Set ONPREM_ENABLED to offer it." },
      ]),
    ).toEqual({ status: "disabled", reason: "Set ONPREM_ENABLED to offer it." });
    expect(onpremHostingFrom([{ id: "onprem-compose", enabled: false, reason: "  " }])).toEqual({
      status: "disabled",
      reason: ONPREM_DISABLED_FALLBACK_REASON,
    });
  });

  it("hides it when an older backend does not list it, or nothing was read", () => {
    expect(onpremHostingFrom([{ id: "render", enabled: true }])).toEqual({ status: "hidden" });
    expect(onpremHostingFrom([])).toEqual({ status: "hidden" });
    expect(onpremHostingFrom(null)).toEqual({ status: "hidden" });
  });
});

describe("Runs on per environment", () => {
  it("sets every row on-prem; switching one back changes only that row", () => {
    const all = runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE);
    expect(all.map(({ runsOn }) => runsOn)).toEqual(["onprem", "onprem", "onprem"]);
    const back = setEnvironmentRunsOn(all, 1, "managed");
    expect(back.map(({ runsOn }) => runsOn)).toEqual(["onprem", "managed", "onprem"]);
  });

  it("travels with its row through reorder and remove", () => {
    const productionOnprem = setEnvironmentRunsOn(ENVIRONMENT_TEMPLATE, 2, "onprem");
    const moved = moveEnvironment(productionOnprem, 2, -1);
    expect(moved[1]).toMatchObject({ slug: "main", runsOn: "onprem" });
    expect(removeEnvironment(moved, 1).some(({ runsOn }) => runsOn === "onprem")).toBe(false);
  });
});

describe("environmentHosting", () => {
  const productionOnprem = setEnvironmentRunsOn(ENVIRONMENT_TEMPLATE, 2, "onprem");

  it("is managed, mixed, or all on-prem", () => {
    expect(hostingOf(ENVIRONMENT_TEMPLATE).mode).toBe("managed");
    const mixed = hostingOf(productionOnprem);
    expect(mixed.mode).toBe("mixed");
    expect(mixed.onprem.map(({ slug }) => slug)).toEqual(["main"]);
    expect(mixed.managed.map(({ slug }) => slug)).toEqual(["dev", "uat"]);
    expect(hostingOf(runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE)).mode).toBe("onprem");
  });

  it("ignores Runs on unless the deployment offers on-prem and the project defines environments", () => {
    const all = runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE);
    expect(hostingOf(all, { onpremStatus: "hidden" }).mode).toBe("managed");
    expect(hostingOf(all, { onpremStatus: "disabled" }).mode).toBe("managed");
    expect(hostingOf(all, { environmentsEnabled: false })).toMatchObject({
      mode: "managed",
      environments: [],
    });
    expect(hostingOf(all, { isMicroservicesShape: true }).environments).toEqual([]);
    expect(hostingOf(all, { isMultiRepoShape: true }).mode).toBe("onprem");
  });

  it("names where each environment runs, in promotion order", () => {
    expect(environmentsRunOnSummary(hostingOf(productionOnprem))).toBe(
      "Test: Managed hosting · UAT: Managed hosting · Production: On-prem host",
    );
    expect(mixedHostingLine(hostingOf(productionOnprem))).toBe(
      "Production runs on your on-prem host; register the host on the project's Hosting tab after the project is created. The hosting below applies to Test and UAT.",
    );
    const twoOnprem = setEnvironmentRunsOn(productionOnprem, 1, "onprem");
    expect(mixedHostingLine(hostingOf(twoOnprem))).toMatch(/^UAT and Production run on/);
  });

  it("labels Delivery on Review", () => {
    expect(hostingDeliveryLabel(true, "managed")).toBe("Deployment setup included");
    expect(hostingDeliveryLabel(false, "managed")).toBe("CI workflow only");
    expect(hostingDeliveryLabel(false, "mixed")).toBe(
      "CI workflow only · on-prem host for some environments",
    );
    expect(hostingDeliveryLabel(true, "onprem")).toBe("On-prem host for every environment");
    expect(ALL_ONPREM_DELIVERY_NOTICE).toBe(
      "Every environment runs on your on-prem host. After the project is created, register the host on the project's Hosting tab.",
    );
  });
});

describe("renderVariablesBlocking", () => {
  it("holds a managed or mixed project, never an all on-prem one", () => {
    expect(renderVariablesBlocking(true, "managed")).toBe(true);
    expect(renderVariablesBlocking(true, "mixed")).toBe(true);
    expect(renderVariablesBlocking(true, "onprem")).toBe(false);
    expect(renderVariablesBlocking(false, "managed")).toBe(false);
  });
});

describe("deployable slots", () => {
  it("are the hosted targets' slots, else the project type's one slot", () => {
    expect(deployableSlots(hostedBackend, "frontend")).toEqual(["backend"]);
    expect(deployableSlots({ ...hostedBackend, enabled: false }, "frontend")).toEqual([
      "frontend",
    ]);
    expect(deployableSlots(undefined, "backend")).toEqual(["backend"]);
  });

  it("are not sent at all unless the deployment offers on-prem", () => {
    const input = {
      deploymentProvisioning: undefined,
      selectedProjectType: { kind: "backend" as const },
      selectedProjectTypeId: "dotnet",
    };
    expect(onpremSlotsFor({ ...input, status: "enabled" })).toEqual(["backend"]);
    expect(onpremSlotsFor({ ...input, status: "disabled" })).toBeUndefined();
    expect(onpremSlotsFor({ ...input, status: "hidden" })).toBeUndefined();
    expect(
      onpremSlotsFor({
        status: "enabled",
        deploymentProvisioning: undefined,
        selectedProjectType: null,
        selectedProjectTypeId: "react",
      }),
    ).toEqual(["frontend"]);
  });
});

describe("withOnpremTargets", () => {
  it("returns the hosted request itself when no environment is on-prem", () => {
    expect(withOnpremTargets(hostedBackend, ENVIRONMENT_TEMPLATE, ["backend"])).toBe(
      hostedBackend,
    );
    expect(withOnpremTargets(undefined, ENVIRONMENT_TEMPLATE, ["backend"])).toBeUndefined();
  });

  it("sends only on-prem targets, one per environment and slot, when every environment is on-prem", () => {
    const all = runEveryEnvironmentOnprem(ENVIRONMENT_TEMPLATE);
    expect(withOnpremTargets(hostedBackend, all, ["backend", "frontend"])).toEqual({
      enabled: true,
      targets: [
        { slot: "backend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "dev" },
        { slot: "frontend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "dev" },
        { slot: "backend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "uat" },
        { slot: "frontend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "uat" },
        { slot: "backend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "main" },
        { slot: "frontend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "main" },
      ],
    });
  });

  it("keeps the hosted shared targets and covers every slot of each on-prem environment when mixed", () => {
    const mixed = setEnvironmentRunsOn(ENVIRONMENT_TEMPLATE, 2, "onprem");
    expect(withOnpremTargets(hostedBackend, mixed, ["backend"])).toEqual({
      enabled: true,
      targets: [
        hostedBackend.targets[0],
        { slot: "backend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "main" },
      ],
    });
    // No hosted configuration: the backend's own default covers the managed ones.
    expect(withOnpremTargets(undefined, mixed, ["frontend"])).toEqual({
      enabled: true,
      targets: [
        { slot: "frontend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "main" },
      ],
    });
  });

  it("never lets an environment have both on-prem and hosted targets", () => {
    const mixed = setEnvironmentRunsOn(ENVIRONMENT_TEMPLATE, 0, "onprem");
    const request = withOnpremTargets(hostedBackend, mixed, ["backend"])!;
    for (const environment of mixed) {
      const own = request.targets.filter(
        (target) => "environmentSlug" in target && target.environmentSlug === environment.slug,
      );
      const shared = request.targets.filter(
        (target) =>
          !("environmentSlug" in target && target.environmentSlug) &&
          !own.some(({ slot }) => slot === target.slot),
      );
      const delivered = new Set(
        [...own, ...shared].map(({ provider }) => provider === "onprem-compose"),
      );
      expect(delivered.size).toBe(1);
    }
  });

  it("uses each slug as it is sent: trimmed", () => {
    const padded: EnvironmentDraft[] = [
      { slug: " prod ", displayName: "Prod", sourceBranch: "main", role: "production", runsOn: "onprem" },
    ];
    expect(withOnpremTargets(undefined, padded, ["backend"])?.targets).toEqual([
      { slot: "backend", provider: "onprem-compose", ownershipMode: "byo", environmentSlug: "prod" },
    ]);
  });
});
