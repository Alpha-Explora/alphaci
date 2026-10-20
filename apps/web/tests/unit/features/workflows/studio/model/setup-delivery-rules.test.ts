import {
  ENVIRONMENT_TEMPLATE,
  type EnvironmentDraft,
} from "../../../../../../src/features/workflows/studio/model/project-environments-rules";
import {
  TEAM_CHOICE_MISSING_MESSAGE,
  createBlockerReason,
  deliveryHostProblems,
  firstHostProblem,
  isDeliveryStepReady,
} from "../../../../../../src/features/workflows/studio/model/setup-delivery-rules";
import { RENDER_VARIABLES_MISSING_MESSAGE } from "../../../../../../src/features/workflows/studio/model/create-target-rules";
import type { UsageLimitItem } from "../../../../../../src/shared/api/contracts";

/**
 * What holds the Delivery step, and the Create blocker the Review step shows:
 * - an on-prem host problem holds Delivery only under on-prem hosting, and only
 *   while machine rows are on screen to fix it;
 * - each blocker that holds Create names itself, in a fixed order.
 */

const PRODUCTION =
  "Add an HTTPS URL or choose the automatic HTTPS address for Production, or choose Assign later.";

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
        requestId: "request-1",
        config: {
          ports: [{ slot: "backend", containerPort: 4000 }],
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

describe("deliveryHostProblems", () => {
  it("names Production under on-prem hosting, with machine rows on screen", () => {
    expect(
      deliveryHostProblems({
        choice: "onprem",
        environments: productionWithoutHttps(),
        machineRowsShown: true,
      }),
    ).toEqual([null, null, PRODUCTION]);
  });

  it("checks every environment as on-prem, though the form holds no Runs on under on-prem", () => {
    // As the Delivery step keeps them: the create request sets "Runs on" itself.
    const [dev, uat, main] = ENVIRONMENT_TEMPLATE;
    const held = productionWithoutHttps()[2]!;
    expect(
      deliveryHostProblems({
        choice: "onprem",
        environments: [dev!, uat!, { ...main!, hostAssignment: held.hostAssignment }],
        machineRowsShown: true,
      }),
    ).toEqual([null, null, PRODUCTION]);
  });

  it("does not check environments under Vercel / Render or CI-only hosting", () => {
    // A machine left on an environment after the user switched hosting: no
    // screen shows it, so it must not hold the step.
    for (const choice of ["hosted", "none"] as const) {
      expect(
        deliveryHostProblems({
          choice,
          environments: productionWithoutHttps(),
          machineRowsShown: true,
        }),
      ).toEqual([null, null, null]);
    }
  });

  it("holds nothing when no healthy machine is shown, so no row would name the fix", () => {
    expect(
      deliveryHostProblems({
        choice: "onprem",
        environments: productionWithoutHttps(),
        machineRowsShown: false,
      }),
    ).toEqual([null, null, null]);
  });

  it("gives no problem when Production has an HTTPS URL", () => {
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
      firstHostProblem(
        deliveryHostProblems({
          choice: "onprem",
          environments: [...environments.slice(0, 2), fixed],
          machineRowsShown: true,
        }),
      ),
    ).toBeNull();
  });
});

describe("firstHostProblem", () => {
  it("is the first problem in order, or null", () => {
    expect(firstHostProblem([null, "a", "b"])).toBe("a");
    expect(firstHostProblem([null, null])).toBeNull();
    expect(firstHostProblem([])).toBeNull();
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
    teamChoiceMissing: false,
    hostProblem: null,
    renderVariablesMissing: false,
    projectBlocker: null,
    projectQuota: null,
  };

  it("is null when nothing holds Create", () => {
    expect(createBlockerReason(none)).toBeNull();
    expect(createBlockerReason({ ...none, projectQuota: quota(1, 5) })).toBeNull();
  });

  it("gives the missing team first", () => {
    expect(
      createBlockerReason({
        ...none,
        teamChoiceMissing: true,
        hostProblem: PRODUCTION,
        projectQuota: quota(5, 5),
      }),
    ).toBe(TEAM_CHOICE_MISSING_MESSAGE);
    expect(TEAM_CHOICE_MISSING_MESSAGE).toBe("Choose the team this project belongs to.");
  });

  it("gives the host problem before the Render variable, the Project blocker or the quota", () => {
    expect(
      createBlockerReason({
        ...none,
        hostProblem: PRODUCTION,
        renderVariablesMissing: true,
        projectBlocker: "This Project has no Feature yet.",
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
