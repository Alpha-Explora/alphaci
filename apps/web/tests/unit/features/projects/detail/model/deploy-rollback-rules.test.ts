import {
  canRollBackTo,
  liveDeployId,
  rollbackConsequence,
  rollbackDoneMessage,
  rollbackHold,
  rollbackReasonProblem,
  withRollbackHold,
} from "@/features/projects/detail/model/deploy-rollback-rules";
import type {
  DeploymentTarget,
  DeploymentTargetActionsResponse,
  ProjectDeploymentHistoryItem,
} from "@/shared/api/contracts";

function deploy(id: string, overrides: Partial<ProjectDeploymentHistoryItem> = {}): ProjectDeploymentHistoryItem {
  return {
    id,
    targetId: "t-1",
    targetName: "orders-api",
    provider: "render",
    environment: null,
    branch: "main",
    commitSha: `${id}aaaaaaa`,
    commitMessage: `deploy ${id}`,
    status: "superseded",
    createdAt: "2026-10-12T10:00:00Z",
    readyAt: null,
    deploymentUrl: null,
    pullRequestNumber: null,
    inspectorUrl: null,
    dashboardUrl: "",
    consoleUrl: "",
    ...overrides,
  };
}

const render = { id: "t-1", provider: "render", providerMetadata: {} } as Pick<
  DeploymentTarget,
  "id" | "provider" | "providerMetadata"
>;
const vercel = { ...render, provider: "vercel" } as typeof render;
const actions = (enabled: boolean) =>
  ({ targetId: "t-1", provider: "render", actions: { rollback: { enabled, resumable: false } } }) as unknown as DeploymentTargetActionsResponse;

describe("deploy rollback rules", () => {
  const history = [deploy("d3", { status: "ready" }), deploy("d2"), deploy("d1", { status: "failed" })];

  it("finds the live deploy: the newest ready one, or the held rollback's", () => {
    expect(liveDeployId(render, history)).toBe("d3");
    expect(liveDeployId({ ...vercel, providerMetadata: { rollback: { deployId: "d2" } } }, history)).toBe("d2");
    // On Vercel only production counts.
    expect(liveDeployId(vercel, [deploy("p", { status: "ready", environment: "preview" }), ...history])).toBe("d3");
  });

  it("offers Roll back only on an earlier deploy that went live, to someone who may, when the backend offers it", () => {
    const liveId = liveDeployId(render, history);
    const offer = (item: ProjectDeploymentHistoryItem, allowed = true, enabled = true) =>
      canRollBackTo({ allowed, actions: actions(enabled), target: render, deploy: item, liveId });
    expect(offer(history[1])).toBe(true);
    expect(offer(history[0])).toBe(false); // live now
    expect(offer(history[2])).toBe(false); // never went live
    expect(offer(history[1], false)).toBe(false); // Product owner / QA
    expect(offer(history[1], true, false)).toBe(false); // provider cannot
    expect(offer(deploy("other", { targetId: "t-2" }))).toBe(false);
    expect(canRollBackTo({ allowed: true, actions: undefined, target: render, deploy: history[1], liveId })).toBe(false);
    expect(
      canRollBackTo({
        allowed: true,
        actions: actions(true),
        target: vercel,
        deploy: deploy("pv", { environment: "preview" }),
        liveId,
      }),
    ).toBe(false);
  });

  it("requires a reason", () => {
    expect(rollbackReasonProblem("checkout broke")).toBeNull();
    expect(rollbackReasonProblem(" a ")).toBe("Say why you are rolling back.");
    expect(rollbackReasonProblem("x".repeat(501))).toBe("Keep the reason under 500 characters.");
  });

  it("says what a rollback does not change, per provider", () => {
    expect(rollbackConsequence("render", "main")).toContain("The next deploy from the pipeline puts the newest code back live");
    expect(rollbackConsequence("vercel", "main")).toContain("New production deploys wait until you resume deploys");
  });

  it("reads, sets and clears the hold on a target", () => {
    const held = withRollbackHold({ providerMetadata: { keep: 1 } }, {
      deployId: "d2",
      commitSha: "abc",
      commitMessage: null,
      reason: "broken",
      rolledBackBy: "u",
      rolledBackAt: "2026-10-12T10:00:00Z",
      holdsNewDeploys: true,
    });
    expect(rollbackHold(held)).toMatchObject({ deployId: "d2", reason: "broken", holdsNewDeploys: true });
    expect(withRollbackHold(held, null).providerMetadata).toEqual({ keep: 1 });
    expect(rollbackHold({ providerMetadata: { rollback: "x" } })).toBeNull();
    expect(rollbackDoneMessage({ providerProjectName: "web" }, "abc1234", { rollback: null })).toBe(
      "web is rolling back to abc1234.",
    );
  });
});
