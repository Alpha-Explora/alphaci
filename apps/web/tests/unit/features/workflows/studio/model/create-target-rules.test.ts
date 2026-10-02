import {
  applicableTargetProject,
  chosenTargetProject,
  createRepositoryBlocker,
  effectiveDeliveryProjectId,
  projectChoiceEntries,
  projectChoiceOptions,
  projectFeaturesBlocker,
  joinedProjectName,
  parseCreateTargetParams,
  preselectedWorkspaceId,
  readTargetProject,
  scopeCreatePayload,
  targetProjectLabel,
} from "../../../../../../src/features/workflows/studio/model/create-target-rules";

const DP = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const TARGET = { id: DP, name: "testfinals", groupId: "ws-1" };
const WORKSPACES = [
  { id: "ws-1", name: "Checkout squad" },
  { id: "ws-2", name: "Payments" },
];

describe("parseCreateTargetParams", () => {
  it("reads ?group= and a UUID ?project=", () => {
    expect(parseCreateTargetParams(new URLSearchParams(`group=ws-1&project=${DP}`))).toEqual({
      groupId: "ws-1",
      deliveryProjectId: DP,
    });
  });

  it("ignores malformed values softly", () => {
    expect(parseCreateTargetParams(new URLSearchParams("group=../etc&project=not-a-uuid"))).toEqual({
      groupId: null,
      deliveryProjectId: null,
    });
    expect(parseCreateTargetParams(new URLSearchParams(""))).toEqual({ groupId: null, deliveryProjectId: null });
  });
});

describe("a Developer's Project choice", () => {
  it("lists the team's Projects as options, in the server's order", () => {
    expect(
      projectChoiceOptions([
        { deliveryProjectId: "dp-2", name: "wallet", featureCount: 0 },
        { deliveryProjectId: "dp-1", name: "testfinals", featureCount: null },
      ]),
    ).toEqual([
      { id: "dp-2", name: "wallet", featureCount: 0 },
      { id: "dp-1", name: "testfinals", featureCount: null },
    ]);
  });

  it("files a pick in the team it was picked in", () => {
    expect(chosenTargetProject({ id: "dp-1", name: "testfinals", featureCount: 1 }, "ws-1")).toEqual({
      id: "dp-1",
      name: "testfinals",
      groupId: "ws-1",
    });
    expect(chosenTargetProject(null, "ws-1")).toBeNull();
    expect(chosenTargetProject({ id: "dp-1", name: "x", featureCount: 1 }, null)).toBeNull();
  });

  const OPTIONS = [
    { id: "dp-1", name: "testfinals", featureCount: 2 },
    { id: "dp-2", name: "wallet", featureCount: 0 },
    { id: "dp-3", name: "legacy", featureCount: null },
  ];

  it("shows a Developer the Projects with no Feature yet, disabled and saying so", () => {
    expect(projectChoiceEntries(OPTIONS, "member")).toEqual([
      { id: "dp-1", label: "testfinals", disabled: false },
      { id: "dp-2", label: "wallet (no Features yet)", disabled: true },
      { id: "dp-3", label: "legacy", disabled: false },
    ]);
    // Admins are exempt.
    expect(projectChoiceEntries(OPTIONS, "admin").every((entry) => !entry.disabled)).toBe(true);
  });

  it("blocks a linked or picked Project with no Feature, and leaves unknown ones to the server", () => {
    const sentence = "Waiting for your Product owner to add the first Feature.";
    expect(projectFeaturesBlocker("dp-2", OPTIONS, "member")).toBe(sentence);
    expect(projectFeaturesBlocker("dp-1", OPTIONS, "member")).toBeNull();
    expect(projectFeaturesBlocker("dp-3", OPTIONS, "member")).toBeNull();
    expect(projectFeaturesBlocker("dp-unknown", OPTIONS, "member")).toBeNull();
    expect(projectFeaturesBlocker(undefined, OPTIONS, "member")).toBeNull();
    expect(projectFeaturesBlocker("dp-2", OPTIONS, "admin")).toBeNull();
  });

  it("blocks Create until the Project is chosen, and on missing Render variables", () => {
    const base = { renderVariablesMissing: false, requiresProject: true, deliveryProjectId: undefined };
    expect(createRepositoryBlocker(base)).toBe("Choose the Project this repository belongs to.");
    expect(createRepositoryBlocker({ ...base, deliveryProjectId: "dp-1" })).toBeNull();
    expect(createRepositoryBlocker({ ...base, requiresProject: false })).toBeNull();
    expect(createRepositoryBlocker({ ...base, renderVariablesMissing: true })).toMatch(/Render environment variable/);
    expect(
      createRepositoryBlocker({ ...base, deliveryProjectId: "dp-2", featuresBlocker: "Waiting for your Product owner to add the first Feature." }),
    ).toBe("Waiting for your Product owner to add the first Feature.");
  });
});

describe("preselectedWorkspaceId", () => {
  it("keeps a choice, then prefers the linked team the caller is in, then a sole team", () => {
    expect(preselectedWorkspaceId("ws-2", "ws-1", WORKSPACES)).toBe("ws-2");
    expect(preselectedWorkspaceId(null, "ws-1", WORKSPACES)).toBe("ws-1");
    expect(preselectedWorkspaceId(null, "ws-9", WORKSPACES)).toBeNull();
    expect(preselectedWorkspaceId(null, "ws-9", [WORKSPACES[1]])).toBe("ws-2");
    expect(preselectedWorkspaceId(null, null, [])).toBeNull();
  });
});

describe("the target Project", () => {
  it("is sent only while creating in its own team", () => {
    expect(effectiveDeliveryProjectId(TARGET, "ws-1")).toBe(DP);
    expect(effectiveDeliveryProjectId(TARGET, "ws-2")).toBeUndefined();
    expect(effectiveDeliveryProjectId(TARGET, null)).toBeUndefined();
    expect(effectiveDeliveryProjectId(null, "ws-1")).toBeUndefined();
  });

  it("names the joined Project only while its own team is selected", () => {
    expect(joinedProjectName(TARGET, "ws-1")).toBe("testfinals");
    expect(joinedProjectName(TARGET, "ws-2")).toBeNull();
    expect(joinedProjectName(null, "ws-1")).toBeNull();
  });

  it("reads as Team / Project in the wizard", () => {
    expect(targetProjectLabel(TARGET, "ws-1", WORKSPACES)).toBe("Checkout squad / testfinals");
    expect(targetProjectLabel(TARGET, "ws-1", null)).toBe("Team / testfinals");
    expect(targetProjectLabel(TARGET, "ws-2", WORKSPACES)).toBeNull();
  });

  it("reads a delivery project reply defensively", () => {
    expect(readTargetProject({ id: DP, name: "testfinals", groupId: "ws-1", status: "active" }, DP)).toEqual(TARGET);
    expect(readTargetProject({ groupId: "ws-1" }, DP)).toEqual({ id: DP, name: "Project", groupId: "ws-1" });
    expect(readTargetProject({ id: DP, groupId: "ws-1", status: "archived" }, DP)).toBeNull();
    expect(readTargetProject({ id: DP }, DP)).toBeNull();
    expect(readTargetProject(null, DP)).toBeNull();
  });

  it("prefers the linked Project, then the one picked, for the team being created in", () => {
    const picked = { id: "dp-pick", name: "wallet", groupId: "ws-2" };
    expect(applicableTargetProject(TARGET, picked, "ws-1")).toBe(TARGET);
    expect(applicableTargetProject(TARGET, picked, "ws-2")).toBe(picked);
    expect(applicableTargetProject(null, picked, "ws-2")).toBe(picked);
    expect(applicableTargetProject(TARGET, picked, "ws-3")).toBeNull();
    expect(applicableTargetProject(null, null, "ws-1")).toBeNull();
  });

  it("scopes the create payload", () => {
    expect(scopeCreatePayload({ repoName: "x" }, "ws-1", DP)).toEqual({ repoName: "x", workspaceId: "ws-1", deliveryProjectId: DP });
    expect(scopeCreatePayload({ repoName: "x" }, undefined, undefined)).toEqual({ repoName: "x" });
  });
});
