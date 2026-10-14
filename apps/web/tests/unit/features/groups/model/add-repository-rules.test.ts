import {
  HOSTING_INVALID_MESSAGE,
  addRepositoryErrorMessage,
  addRepositoryRequest,
  repositoryOutcome,
  resolveHostingChoice,
  singleRepositoryShapes,
  NO_HOSTING_OVERRIDES,
} from "../../../../../src/features/groups/model/add-repository-rules";
import type { CreatedRepositoryResponse } from "../../../../../src/features/groups/data/hierarchy-contracts";
import type { CreateProjectRequest, DeploymentProvisioningRequest } from "../../../../../src/shared/api/contracts";
import { ApiError } from "../../../../../src/shared/api/request";

const wizard: CreateProjectRequest = {
  repoName: "checkout-web",
  visibility: "private",
  repoShape: "standalone",
  projectTypeId: "nextjs",
  workflowRecipeId: "standard",
  serviceName: "checkout-web",
  servicePath: ".",
  nodeVersion: "24",
  coverageThreshold: 80,
  tests: { lint: true, unit: true },
  outputFileName: "ci.yml",
  ownerType: "organization",
  installationId: 7,
};

const formPayload: DeploymentProvisioningRequest = {
  enabled: true,
  targets: [
    {
      slot: "frontend",
      provider: "vercel",
      ownershipMode: "flowci_managed",
      projectName: "checkout-web",
      branchName: "uat",
      rootDirectory: ".",
      buildCommand: "npm run build",
      env: [],
    },
  ],
};

function created(outcome: CreatedRepositoryResponse["provisioning"]["hosting"]["outcome"], failures = [] as Array<{ slot: string; provider: string; reason: string }>): CreatedRepositoryResponse {
  return {
    id: "r1",
    deliveryProjectId: "dp1",
    name: "checkout-web",
    status: "active",
    visibility: "private",
    provisionedProjectId: "proj-9",
    repoFullName: "org/checkout-web",
    htmlUrl: null,
    assignmentCount: 0,
    createdAt: "2026-10-08T00:00:00Z",
    updatedAt: "2026-10-08T00:00:00Z",
    provisioning: {
      projectId: "proj-9",
      repoFullName: "org/checkout-web",
      repoUrl: "https://github.com/org/checkout-web",
      workflowPath: ".github/workflows/ci.yml",
      branchesCreated: ["main", "uat"],
      hosting: { outcome, failures },
    },
  };
}

describe("addRepositoryRequest", () => {
  it("sends the stack as projectTypeId and the wizard's setup, minus owner fields", () => {
    const body = addRepositoryRequest(wizard, { mode: "managed" });
    expect(body).toEqual({
      name: "checkout-web",
      projectTypeId: "nextjs",
      visibility: "private",
      serviceName: "checkout-web",
      repoShape: "standalone",
      workflowRecipeId: "standard",
      servicePath: ".",
      nodeVersion: "24",
      coverageThreshold: 80,
      tests: { lint: true, unit: true },
      outputFileName: "ci.yml",
    });
    expect(body).not.toHaveProperty("deploymentProvisioning");
    expect(body).not.toHaveProperty("installationId");
  });

  it("turns hosting off explicitly, since an omitted request means managed defaults", () => {
    expect(addRepositoryRequest(wizard, { mode: "off" }).deploymentProvisioning).toEqual({
      enabled: false,
      targets: [],
    });
  });

  it("keeps a mono shape and sends a customised hosting request", () => {
    const body = addRepositoryRequest({ ...wizard, repoShape: "mono" }, { mode: "custom", request: formPayload });
    expect(body.repoShape).toBe("mono");
    expect(body.deploymentProvisioning).toBe(formPayload);
  });
});

describe("resolveHostingChoice", () => {
  it("leaves managed hosting to the server without Advanced edits", () => {
    expect(resolveHostingChoice({ hostingEnabled: true, overrides: NO_HOSTING_OVERRIDES, formPayload })).toEqual({
      mode: "managed",
    });
  });

  it("is off when hosting is turned off", () => {
    expect(
      resolveHostingChoice({ hostingEnabled: false, overrides: { rootDirectory: "web", buildCommand: "" }, formPayload }),
    ).toEqual({ mode: "off" });
  });

  it("applies Advanced edits to the wizard form's default target", () => {
    const choice = resolveHostingChoice({
      hostingEnabled: true,
      overrides: { rootDirectory: " web ", buildCommand: "" },
      formPayload,
    });
    expect(choice.mode).toBe("custom");
    if (choice.mode !== "custom") return;
    expect(choice.request.targets[0]).toMatchObject({ rootDirectory: "web", buildCommand: "npm run build" });
  });

  it("falls back to managed defaults when the form has no payload yet", () => {
    expect(
      resolveHostingChoice({ hostingEnabled: true, overrides: { rootDirectory: "web", buildCommand: "" }, formPayload: undefined }),
    ).toEqual({ mode: "managed" });
  });
});

describe("singleRepositoryShapes", () => {
  it("offers only enabled one-repository shapes, never the two-repo pair", () => {
    const shapes = [
      { id: "standalone", label: "Single", enabled: true },
      { id: "multi", label: "Pair", enabled: true },
      { id: "mono", label: "Monorepo", enabled: false },
    ];
    expect(singleRepositoryShapes(shapes).map((s) => s.id)).toEqual(["standalone"]);
  });
});

describe("repositoryOutcome", () => {
  it("provisioned: created with hosting, links the repository in-app", () => {
    const view = repositoryOutcome(created("provisioned"));
    expect(view.tone).toBe("success");
    expect(view.message).toContain("its hosting is set up");
    expect(view.hostingHref).toBeNull();
    expect(view.repositoryHref).toBe("/projects/proj-9");
  });

  it("skipped: created without hosting", () => {
    const view = repositoryOutcome(created("skipped"));
    expect(view.tone).toBe("success");
    expect(view.message).toContain("No hosting was set up");
  });

  it("failed: lists each reason and links the Hosting tab", () => {
    const view = repositoryOutcome(
      created("failed", [{ slot: "frontend", provider: "vercel", reason: "Vercel token rejected" }]),
    );
    expect(view.tone).toBe("warning");
    expect(view.message).toBe("Repository created; hosting couldn't be set up:");
    expect(view.reasons).toEqual(["Vercel: Vercel token rejected"]);
    expect(view.hostingHref).toBe("/projects/proj-9#hosting");
    expect(view.hostingHref).not.toContain("github.com");
  });

  it("partial: says not fully, and never leaves the reasons empty", () => {
    const view = repositoryOutcome(created("partial"));
    expect(view.message).toBe("Repository created; hosting couldn't be fully set up:");
    expect(view.reasons).toEqual(["No reason was reported."]);
  });
});

describe("addRepositoryErrorMessage", () => {
  const refusal = (status: number, code?: string) =>
    new ApiError(`Request failed with status ${status}`, status, code ? { code, message: ["bad"] } : { message: "x" });

  it("maps the 400 codes", () => {
    expect(addRepositoryErrorMessage(refusal(400, "DEPLOYMENT_PROVISIONING_INVALID"))).toBe(HOSTING_INVALID_MESSAGE);
    expect(addRepositoryErrorMessage(refusal(409, "PROJECT_FEATURES_REQUIRED"))).toBe(
      "Waiting for your Product owner to add the first Feature.",
    );
    expect(addRepositoryErrorMessage(refusal(403, "REPOSITORY_CREATE_FORBIDDEN"))).toBe(
      "Developers create repositories inside a Project.",
    );
    expect(addRepositoryErrorMessage(refusal(400))).toContain("Check the name and stack");
  });

  it("keeps the name clash and a generic fallback", () => {
    expect(addRepositoryErrorMessage(refusal(409))).toBe("A repository with that name already exists.");
    expect(addRepositoryErrorMessage(new Error("network"))).toBe("The repository could not be created. Please try again.");
  });
});
