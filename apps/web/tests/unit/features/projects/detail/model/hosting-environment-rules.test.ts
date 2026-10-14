import {
  deploysForEnvironment,
  deriveHostingEnvironments,
  environmentAddress,
  environmentPillLabel,
  environmentScopeBranch,
  hostingEmptyBody,
  hostingNotice,
  isKnownUndeployed,
  loudestTone,
  missingKeysHeadline,
  missingLaneKeys,
  nextTabIndex,
  deployTone,
  resolvePreviewBranch,
  selectEnvironment,
  serviceMeta,
  targetDeploys,
  undeployedSentence,
  variableSetLabel,
  variablesInScope,
  variablesScopeLine,
} from "../../../../../../src/features/projects/detail/model/hosting-environment-rules";
import type {
  EnvVarMetadata,
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
} from "../../../../../../src/shared/api/contracts";

const TARGET = { id: "t-web", branchName: "main" };

function preview(branch: string, overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch,
    isProduction: branch === "main",
    deploymentId: "d1",
    targetId: "t-web",
    targetName: "web",
    provider: "vercel",
    status: "ready",
    commitSha: "abc1234def",
    commitMessage: null,
    pullRequestNumber: null,
    previewUrl: `https://web-${branch}.vercel.app`,
    inspectorUrl: null,
    createdAt: "2026-10-12T10:00:00Z",
    readyAt: null,
    embeddable: null,
    embedBlockedReason: null,
    ...overrides,
  };
}

function variable(key: string, overrides: Partial<EnvVarMetadata> = {}): EnvVarMetadata {
  return {
    id: `${key}-${overrides.gitBranch ?? "prod"}`,
    projectId: "p1",
    deploymentTargetId: "t-web",
    lane: "production",
    gitBranch: null,
    key,
    provider: "vercel",
    valueStored: false,
    lastProvisionedAt: "2026-10-11T10:00:00Z",
    lastProvisionedBy: "lim",
    status: "provisioned",
    errorSummary: null,
    ...overrides,
  };
}

function deploy(id: string, branch: string | null, createdAt: string, targetId = "t-web"): ProjectDeploymentHistoryItem {
  return {
    id,
    targetId,
    targetName: "web",
    provider: "vercel",
    environment: null,
    branch,
    commitSha: null,
    commitMessage: null,
    status: "ready",
    createdAt,
    readyAt: null,
    deploymentUrl: null,
    pullRequestNumber: null,
    inspectorUrl: null,
    dashboardUrl: "https://vercel.com/x",
    consoleUrl: "https://vercel.com/x/deployments",
  };
}

describe("deriveHostingEnvironments", () => {
  it("always offers Production, with its branch and state under the name", () => {
    const [production, ...rest] = deriveHostingEnvironments({
      target: TARGET,
      previews: [preview("main")],
      metadata: [],
      deployments: [],
    });
    expect(rest).toEqual([]);
    expect(production).toMatchObject({ kind: "production", lane: "production", branch: "main", tone: "ok", subLabel: "main · live" });
  });

  it("offers UAT only when the repository has a uat lane or branch", () => {
    const fromVariables = deriveHostingEnvironments({
      target: TARGET,
      previews: [],
      metadata: [variable("API_URL", { lane: "preview", gitBranch: "uat" })],
      deployments: [],
    });
    expect(fromVariables.map((environment) => environment.kind)).toEqual(["production", "uat"]);
    expect(fromVariables[1]).toMatchObject({ lane: "preview", branch: "uat", tone: "idle", subLabel: "uat · not deployed" });

    const fromTarget = deriveHostingEnvironments({ target: { id: "t-web", branchName: "uat" }, previews: [], metadata: [], deployments: [] });
    expect(fromTarget.map((environment) => environment.kind)).toEqual(["production", "uat"]);
  });

  it("collects every other branch under Previews, counted and coloured by the loudest", () => {
    const environments = deriveHostingEnvironments({
      target: TARGET,
      previews: [preview("main"), preview("uat"), preview("feat/a"), preview("feat/b", { status: "failed" })],
      metadata: [variable("X", { lane: "preview", gitBranch: "feat/c" })],
      deployments: [],
    });
    const previews = environments[2];
    expect(previews).toMatchObject({ kind: "previews", branch: null, tone: "danger", subLabel: "3 branches" });
    expect(previews.previewBranches).toEqual(["feat/a", "feat/b", "feat/c"]);
  });

  it("ignores other targets' previews and variables", () => {
    const environments = deriveHostingEnvironments({
      target: TARGET,
      previews: [preview("uat", { targetId: "t-api" })],
      metadata: [variable("X", { lane: "preview", gitBranch: "feat/x", deploymentTargetId: "t-api" })],
      deployments: [],
    });
    expect(environments.map((environment) => environment.kind)).toEqual(["production"]);
  });

  it("says the status is unknown while previews cannot be read, and falls back on deploy history for branches", () => {
    const environments = deriveHostingEnvironments({
      target: TARGET,
      previews: null,
      metadata: [],
      deployments: [deploy("d1", "uat", "2026-10-12T10:00:00Z"), deploy("d2", "feat/x", "2026-10-12T09:00:00Z")],
    });
    expect(environments.map((environment) => environment.subLabel)).toEqual([
      "main · status unknown",
      "uat · status unknown",
      "1 branch",
    ]);
  });

  it("does not resurrect branches from deploy history once previews are known", () => {
    const environments = deriveHostingEnvironments({
      target: TARGET,
      previews: [],
      metadata: [],
      deployments: [deploy("d1", "feat/old", "2026-10-01T10:00:00Z")],
    });
    expect(environments).toHaveLength(1);
  });

  it("selects Production when the asked environment is not offered", () => {
    const environments = deriveHostingEnvironments({ target: TARGET, previews: [], metadata: [], deployments: [] });
    expect(selectEnvironment(environments, "uat").kind).toBe("production");
  });
});

describe("missingLaneKeys", () => {
  const metadata = [
    variable("API_URL"),
    variable("SENTRY_DSN"),
    variable("STRIPE_KEY"),
    variable("API_URL", { lane: "preview", gitBranch: "uat" }),
    variable("OLD", { removedAt: "2026-10-01T00:00:00Z" }),
    variable("OTHER", { deploymentTargetId: "t-api" }),
  ];

  it("lists the production keys this preview lane lacks, sorted", () => {
    expect(missingLaneKeys(metadata, "t-web", "preview", "uat")).toEqual(["SENTRY_DSN", "STRIPE_KEY"]);
  });

  it("is empty for the production lane itself", () => {
    expect(missingLaneKeys(metadata, "t-web", "production", null)).toEqual([]);
  });

  it("treats every key as missing on a branch with no variables, and ignores removed keys and other targets", () => {
    expect(missingLaneKeys(metadata, "t-web", "preview", "feat/x")).toEqual(["API_URL", "SENTRY_DSN", "STRIPE_KEY"]);
  });

  it("is empty when the lane has them all", () => {
    expect(missingLaneKeys([variable("A"), variable("A", { lane: "preview", gitBranch: "uat" })], "t-web", "preview", "uat")).toEqual([]);
  });

  it("names the count in the headline", () => {
    expect(missingKeysHeadline(1)).toBe("1 variable set in Production is missing here");
    expect(missingKeysHeadline(2)).toBe("2 variables set in Production are missing here");
  });
});

describe("variables in scope", () => {
  it("keeps one lane of one target, by key", () => {
    const metadata = [variable("B"), variable("A"), variable("C", { lane: "preview", gitBranch: "uat" })];
    expect(variablesInScope(metadata, "t-web", "production", null).map((item) => item.key)).toEqual(["A", "B"]);
    expect(variablesInScope(metadata, "t-web", "preview", "uat").map((item) => item.key)).toEqual(["C"]);
  });

  it("says the scope in one line", () => {
    expect(variablesScopeLine("production", null, 6)).toBe("Production · branch main · 6 variables");
    expect(variablesScopeLine("preview", "uat", 1)).toBe("Preview · branch uat · 1 variable");
  });

  it("says when and by whom a variable was set", () => {
    const now = Date.parse("2026-10-13T10:00:00Z");
    expect(variableSetLabel(variable("A"), now)).toBe("set 2d ago by lim");
    expect(variableSetLabel({ lastProvisionedAt: "2026-10-13T09:59:30Z", lastProvisionedBy: "" }, now)).toBe("set just now");
  });

  it("scopes Production to no branch, UAT to uat and Previews to the chosen branch", () => {
    expect(environmentScopeBranch({ kind: "production", branch: "main" }, "feat/a")).toBeNull();
    expect(environmentScopeBranch({ kind: "uat", branch: "uat" }, "feat/a")).toBe("uat");
    expect(environmentScopeBranch({ kind: "previews", branch: null }, "feat/a")).toBe("feat/a");
  });

  it("keeps the asked preview branch while it exists, else the first", () => {
    expect(resolvePreviewBranch(["a", "b"], "b")).toBe("b");
    expect(resolvePreviewBranch(["a", "b"], "gone")).toBe("a");
    expect(resolvePreviewBranch([], null)).toBeNull();
  });
});

describe("deploys", () => {
  const history = [
    deploy("old-main", "main", "2026-10-10T10:00:00Z"),
    deploy("new-main", "main", "2026-10-12T10:00:00Z"),
    deploy("uat", "uat", "2026-10-11T10:00:00Z"),
    deploy("feat", "feat/a", "2026-10-11T12:00:00Z"),
    deploy("api", "main", "2026-10-12T11:00:00Z", "t-api"),
  ];

  it("filters by the environment's branch, newest first", () => {
    expect(deploysForEnvironment(history, "t-web", { kind: "production", branch: "main" })).toEqual({
      items: [history[1], history[0]],
      byBranch: true,
    });
    expect(deploysForEnvironment(history, "t-web", { kind: "previews", branch: null }).items.map((item) => item.id)).toEqual(["feat"]);
  });

  it("returns the service's latest unfiltered when the history names no branches", () => {
    const branchless = [deploy("a", null, "2026-10-10T10:00:00Z"), deploy("b", null, "2026-10-11T10:00:00Z")];
    expect(deploysForEnvironment(branchless, "t-web", { kind: "uat", branch: "uat" })).toEqual({
      items: [branchless[1], branchless[0]],
      byBranch: false,
    });
  });

  it("lists every deploy of the target for All deploys", () => {
    expect(targetDeploys(history, "t-web").map((item) => item.id)).toEqual(["new-main", "feat", "uat", "old-main"]);
  });

  it("colours a deploy's dot: failed and error are danger, building and queued amber, ready success", () => {
    expect(deployTone("failed")).toBe("danger");
    expect(deployTone("error")).toBe("danger");
    expect(deployTone("ERROR")).toBe("danger");
    expect(deployTone("canceled")).toBe("danger");
    expect(deployTone("building")).toBe("pending");
    expect(deployTone("queued")).toBe("pending");
    expect(deployTone("ready")).toBe("ok");
    expect(deployTone("unknown")).toBe("idle");
  });
});

describe("hostingNotice", () => {
  const base = { provider: "vercel" as const, deployments: null, deploymentsError: null, previews: null, previewsError: null };

  it("is null when everything answered", () => {
    expect(hostingNotice({ ...base, deployments: { mode: "live", providerError: null }, previews: { providerError: null } })).toBeNull();
  });

  it("names the provider that did not answer, whichever read noticed", () => {
    const text = "Vercel didn't answer, so deploy history may be incomplete.";
    expect(hostingNotice({ ...base, deployments: { mode: "live", providerError: "vercel: 503" } })).toBe(text);
    expect(hostingNotice({ ...base, deployments: { mode: "unavailable", providerError: null } })).toBe(text);
    expect(hostingNotice({ ...base, previews: { providerError: "vercel timed out" } })).toBe(text);
    expect(hostingNotice({ ...base, provider: "render", previews: { providerError: "x" } })).toBe(
      "Render didn't answer, so deploy history may be incomplete.",
    );
  });

  it("says ALPHACI could not load it when our own read failed", () => {
    expect(hostingNotice({ ...base, deploymentsError: "Unable to load deployment history." })).toBe(
      "ALPHACI couldn't load deploy history, so it may be incomplete.",
    );
  });
});

describe("deployment card rules", () => {
  it("uses the branch's own address, else (Production only) the service URL", () => {
    expect(environmentAddress({ kind: "uat", preview: preview("uat") }, "https://web.vercel.app")).toBe("https://web-uat.vercel.app");
    expect(environmentAddress({ kind: "uat", preview: null }, "https://web.vercel.app")).toBeNull();
    expect(environmentAddress({ kind: "production", preview: null }, "https://web.vercel.app")).toBe("https://web.vercel.app");
  });

  it("knows an environment is undeployed only when the previews read says so", () => {
    expect(isKnownUndeployed({ preview: preview("uat", { status: "not_deployed" }) }, true)).toBe(true);
    expect(isKnownUndeployed({ preview: null }, true)).toBe(true);
    expect(isKnownUndeployed({ preview: null }, false)).toBe(false);
    expect(isKnownUndeployed({ preview: preview("uat") }, true)).toBe(false);
  });

  it("says one sentence for an undeployed environment", () => {
    expect(undeployedSentence("uat", true)).toBe("Nothing is deployed here yet. The first merge into uat publishes to this address.");
    expect(undeployedSentence("uat", false)).toBe("Nothing is deployed here yet. The first merge into uat publishes it.");
  });

  it("labels the pill with the status word", () => {
    expect(environmentPillLabel({ kind: "production", preview: preview("main"), tone: "ok" }, true)).toBe("Live");
    expect(environmentPillLabel({ kind: "uat", preview: null, tone: "idle" }, true)).toBe("Not deployed");
    expect(environmentPillLabel({ kind: "previews", preview: null, tone: "danger" }, true)).toBe("Failed");
  });

  it("picks the loudest tone", () => {
    expect(loudestTone([])).toBe("idle");
    expect(loudestTone(["ok", "pending", "idle"])).toBe("pending");
  });
});

describe("serviceMeta", () => {
  it("reads provider, slot and source, with the build command and root apart", () => {
    expect(serviceMeta({ provider: "vercel", slot: "frontend", buildCommand: "npm run build", rootDirectory: "apps/web" })).toEqual({
      summary: "Vercel · Frontend · deploys from Git",
      buildCommand: "npm run build",
      rootDirectory: "apps/web",
    });
    expect(serviceMeta({ provider: "render", slot: "backend", buildCommand: " ", rootDirectory: null, imageUrl: "ghcr.io/x" })).toEqual({
      summary: "Render · Backend · deploys an image",
      buildCommand: null,
      rootDirectory: ".",
    });
  });
});

describe("nextTabIndex", () => {
  it("moves with the arrow keys, wrapping, and jumps with Home and End", () => {
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextTabIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
    expect(nextTabIndex("Enter", 0, 3)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("hostingEmptyBody", () => {
  it("offers the create flow only to those who may host, with provisioning on, on a provisioned repository", () => {
    expect(hostingEmptyBody({ canManage: true, envProvisioningEnabled: true, provisioned: true })).toBe("create");
    expect(hostingEmptyBody({ canManage: false, envProvisioningEnabled: true, provisioned: true })).toBe("lead_only");
    expect(hostingEmptyBody({ canManage: true, envProvisioningEnabled: false, provisioned: true })).toBe("disabled");
    expect(hostingEmptyBody({ canManage: true, envProvisioningEnabled: true, provisioned: false })).toBe("not_provisioned");
  });
});
