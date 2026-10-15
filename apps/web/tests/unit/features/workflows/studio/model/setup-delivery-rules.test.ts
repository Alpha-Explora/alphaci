import {
  ENVIRONMENT_TEMPLATE,
  type EnvironmentDraft,
} from "../../../../../../src/features/workflows/studio/model/project-environments-rules";
import {
  createBlockerReason,
  deliveryHostProblem,
  isDeliveryStepReady,
  onpremHostProblems,
} from "../../../../../../src/features/workflows/studio/model/setup-delivery-rules";
import { RENDER_VARIABLES_MISSING_MESSAGE } from "../../../../../../src/features/workflows/studio/model/create-target-rules";
import type { UsageLimitItem } from "../../../../../../src/shared/api/contracts";

/**
 * What holds the Delivery step, and the Create blocker the Review step shows:
 * - an on-prem host problem holds Delivery only under on-prem hosting, since
 *   only on-prem sends its environments;
 * - each blocker that holds Create names itself, in a fixed order.
 */

const PRODUCTION = "Add an HTTPS URL for Production, or choose Assign later.";

/** The fixed path with Production on a machine that has no HTTPS URL. */
function productionWithoutHttps(): EnvironmentDraft[] {
  const [dev, uat, main] = ENVIRONMENT_TEMPLATE;
  return [
    { ...dev!, runsOn: "onprem" },
    { ...uat!, runsOn: "onprem" },
    {
      ...main!,
      runsOn: "onprem",
      hostAssignment: {
        machineId: "machine-1",
        requestId: "request-1",
        config: {
          ports: [{ slot: "backend", hostPort: 8082, containerPort: 4000 }],
          health: [{ slot: "backend", path: "/" }],
          ingress: { mode: "configured", publicUrl: null },
        },
      },
    },
  ];
}

function quota(current: number, limit: number, upgradeRequired = false): UsageLimitItem {
  return { code: "projects", current, limit, upgradeRequired };
}

describe("deliveryHostProblem", () => {
  it("names the Production problem under on-prem hosting", () => {
    expect(
      deliveryHostProblem({ choice: "onprem", environments: productionWithoutHttps() }),
    ).toBe(PRODUCTION);
  });

  it("checks every environment as on-prem, though the form holds no Runs on under on-prem", () => {
    // As the Delivery step keeps them: the create request sets "Runs on" itself.
    const [dev, uat, main] = ENVIRONMENT_TEMPLATE;
    const held = productionWithoutHttps()[2]!;
    expect(
      deliveryHostProblem({
        choice: "onprem",
        environments: [dev!, uat!, { ...main!, hostAssignment: held.hostAssignment }],
      }),
    ).toBe(PRODUCTION);
  });

  it("does not check environments under Vercel / Render or CI-only hosting", () => {
    // A machine left on an environment after the user switched hosting: no
    // screen shows it, so it must not hold the step.
    expect(
      deliveryHostProblem({ choice: "hosted", environments: productionWithoutHttps() }),
    ).toBeNull();
    expect(
      deliveryHostProblem({ choice: "none", environments: productionWithoutHttps() }),
    ).toBeNull();
  });

  it("has no problem on-prem when Production has an HTTPS URL", () => {
    const environments = productionWithoutHttps();
    const main = environments[2]!;
    const fixed: EnvironmentDraft = {
      ...main,
      hostAssignment: {
        ...main.hostAssignment!,
        config: {
          ...main.hostAssignment!.config,
          ingress: { mode: "configured", publicUrl: "https://ledger.example.com" },
        },
      },
    };
    expect(
      deliveryHostProblem({
        choice: "onprem",
        environments: [...environments.slice(0, 2), fixed],
      }),
    ).toBeNull();
  });

  it("has no problem on-prem while every environment is on Assign later", () => {
    expect(
      deliveryHostProblem({
        choice: "onprem",
        environments: ENVIRONMENT_TEMPLATE.map((environment) => ({
          ...environment,
          runsOn: "onprem" as const,
        })),
      }),
    ).toBeNull();
  });
});

describe("onpremHostProblems", () => {
  it("gives each environment its own problem, in promotion order", () => {
    expect(onpremHostProblems(productionWithoutHttps())).toEqual([null, null, PRODUCTION]);
  });
});

describe("isDeliveryStepReady", () => {
  it("is ready when neither the Render variables nor a host problem hold it", () => {
    expect(isDeliveryStepReady({ renderVariablesMissing: false, hostProblem: null })).toBe(true);
  });

  it("is held by a host problem, even with nothing else missing", () => {
    expect(isDeliveryStepReady({ renderVariablesMissing: false, hostProblem: PRODUCTION })).toBe(
      false,
    );
  });

  it("is held by missing Render variables, as before", () => {
    expect(isDeliveryStepReady({ renderVariablesMissing: true, hostProblem: null })).toBe(false);
  });
});

describe("createBlockerReason", () => {
  const none = {
    hostProblem: null,
    renderVariablesMissing: false,
    projectBlocker: null,
    projectQuota: null,
  };

  it("is null when nothing holds Create", () => {
    expect(createBlockerReason(none)).toBeNull();
    expect(createBlockerReason({ ...none, projectQuota: quota(1, 5) })).toBeNull();
  });

  it("gives the host problem first", () => {
    expect(
      createBlockerReason({
        ...none,
        hostProblem: PRODUCTION,
        renderVariablesMissing: true,
        projectQuota: quota(5, 5),
      }),
    ).toBe(PRODUCTION);
  });

  it("gives the missing Render variable before a Project blocker or the quota", () => {
    expect(
      createBlockerReason({
        ...none,
        renderVariablesMissing: true,
        projectBlocker: "This Project has no Feature yet.",
        projectQuota: quota(5, 5),
      }),
    ).toBe(RENDER_VARIABLES_MISSING_MESSAGE);
  });

  it("gives the Project's blocker before the quota", () => {
    expect(
      createBlockerReason({
        ...none,
        projectBlocker: "This Project has no Feature yet.",
        projectQuota: quota(5, 5),
      }),
    ).toBe("This Project has no Feature yet.");
  });

  it("names the quota once it is reached, with its status", () => {
    expect(createBlockerReason({ ...none, projectQuota: quota(5, 5, true) })).toBe(
      "Project quota: Limit reached. Upgrade to continue.",
    );
    expect(createBlockerReason({ ...none, projectQuota: quota(5, 5) })).toBe(
      "Project quota: Limit reached.",
    );
  });
});
