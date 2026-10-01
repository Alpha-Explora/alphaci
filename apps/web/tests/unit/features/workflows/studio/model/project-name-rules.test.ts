import { buildCreateProjectPayload } from "../../../../../../src/features/workflows/studio/model/create-project-payload";
import {
  PROJECT_NAME_TAKEN_MESSAGE,
  addingToProjectLine,
  isProjectNameStepReady,
  isProjectNameTakenError,
  projectNameFieldMessage,
  projectNameForRequest,
  reviewProjectLabel,
  validateProjectName,
} from "../../../../../../src/features/workflows/studio/model/project-name-rules";
import {
  isExistingSetupDisabled,
  isRepositoryStepReady,
} from "../../../../../../src/features/workflows/studio/model/setup-tab-rules";
import { scopeCreatePayload } from "../../../../../../src/features/workflows/studio/model/create-target-rules";
import { ApiError } from "../../../../../../src/shared/api/request";

const TESTS = { lint: true, unit: true, build: true, coverage: true, security: true, docker: false };

function input(projectName: string | null) {
  return {
    projectName,
    repoName: "demo-app",
    visibility: "private" as const,
    serviceName: "demo-app",
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
    repoShapeId: "single-app",
    projectTypeId: "nextjs-app",
    workflowRecipeId: "frontend-standard-ci",
    tests: TESTS,
  };
}

describe("validateProjectName", () => {
  it("trims and accepts 1..80 characters", () => {
    expect(validateProjectName("  Checkout platform ")).toEqual({ ok: true, name: "Checkout platform" });
    expect(validateProjectName("a")).toEqual({ ok: true, name: "a" });
    expect(validateProjectName("x".repeat(80)).ok).toBe(true);
    // Length is judged after trimming.
    expect(validateProjectName(` ${"x".repeat(80)} `).ok).toBe(true);
  });

  it("refuses blank, over-long and control characters", () => {
    expect(validateProjectName("")).toEqual({ ok: false, message: "Project name is required." });
    expect(validateProjectName("   ").ok).toBe(false);
    expect(validateProjectName("x".repeat(81))).toEqual({
      ok: false,
      message: "Project name must be 80 characters or fewer.",
    });
    for (const bad of ["a\tb", "a\u0000b", "a\u001Fb", "a\u007Fb", "a\u0085b"]) {
      expect(validateProjectName(bad)).toEqual({
        ok: false,
        message: "Project name cannot contain control characters.",
      });
    }
  });

  it("accepts spaces, punctuation and non-latin text", () => {
    expect(validateProjectName("Payments & Billing (v2) – 決済").ok).toBe(true);
  });
});

describe("the field message", () => {
  it("stays quiet when empty, explains rejected text, and prefers the server's refusal", () => {
    expect(projectNameFieldMessage("", null)).toBeNull();
    expect(projectNameFieldMessage("   ", null)).toBeNull();
    expect(projectNameFieldMessage("fine", null)).toBeNull();
    expect(projectNameFieldMessage("x".repeat(81), null)).toBe("Project name must be 80 characters or fewer.");
    expect(projectNameFieldMessage("fine", PROJECT_NAME_TAKEN_MESSAGE)).toBe(PROJECT_NAME_TAKEN_MESSAGE);
  });
});

describe("step readiness", () => {
  const base = { repoName: "demo", isMicroservicesShape: false, isMultiRepoShape: false, serviceName: "demo" };

  it("needs a valid Project name unless the repository joins one", () => {
    expect(isRepositoryStepReady({ ...base, projectName: "" })).toBe(false);
    expect(isRepositoryStepReady({ ...base, projectName: "x".repeat(81) })).toBe(false);
    expect(isRepositoryStepReady({ ...base, projectName: "Checkout" })).toBe(true);
    expect(isRepositoryStepReady({ ...base, projectName: null })).toBe(true);
    // Both shapes of the step ask for it.
    expect(
      isRepositoryStepReady({ ...base, projectName: "", isMultiRepoShape: true, serviceName: "" }),
    ).toBe(false);
    expect(
      isRepositoryStepReady({ ...base, projectName: "Checkout", isMultiRepoShape: true, serviceName: "" }),
    ).toBe(true);
  });

  it("stays blocked while the name is refused, until it is edited", () => {
    expect(isProjectNameStepReady("Checkout", PROJECT_NAME_TAKEN_MESSAGE)).toBe(false);
    expect(isProjectNameStepReady("Checkout", null)).toBe(true);
    expect(isProjectNameStepReady(null, PROJECT_NAME_TAKEN_MESSAGE)).toBe(true);
  });

  it("gates Set up CI/CD on the name too", () => {
    const existing = {
      isDiscoveringExistingRepo: false,
      isSettingUpExistingRepo: false,
      loadingProjectOptions: false,
      existingRepoFullName: "tone/app",
      hasSelectedProjectType: true,
    };
    expect(isExistingSetupDisabled({ ...existing, projectName: "" })).toBe(true);
    expect(isExistingSetupDisabled({ ...existing, projectName: "Checkout" })).toBe(false);
    expect(
      isExistingSetupDisabled({ ...existing, projectName: "Checkout", projectNameServerError: "taken" }),
    ).toBe(true);
  });
});

describe("create payload", () => {
  it("includes the trimmed projectName without a deliveryProjectId", () => {
    const result = buildCreateProjectPayload(input("  Checkout platform  "));
    expect(result).toMatchObject({ ok: true, payload: { projectName: "Checkout platform", repoName: "demo-app" } });
  });

  it("includes it for the two-repository shapes as well", () => {
    for (const shape of [{ isMicroservicesShape: true }, { isMultiRepoShape: true }]) {
      const result = buildCreateProjectPayload({ ...input("Checkout platform"), ...shape });
      expect(result).toMatchObject({ ok: true, payload: { projectName: "Checkout platform" } });
    }
  });

  it("omits it when the repository joins an existing Project", () => {
    const joined = projectNameForRequest("Typed earlier", "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b");
    expect(joined).toBeNull();
    const result = buildCreateProjectPayload(input(joined));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).not.toHaveProperty("projectName");
    const scoped = scopeCreatePayload(result.payload, "ws-1", "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b");
    expect(scoped).toMatchObject({ deliveryProjectId: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b" });
    expect(scoped).not.toHaveProperty("projectName");
  });

  it("sends the trimmed name when there is no Project to join", () => {
    expect(projectNameForRequest("  Checkout ", undefined)).toBe("Checkout");
  });

  it("refuses an invalid name before anything else", () => {
    expect(buildCreateProjectPayload(input(""))).toEqual({ ok: false, message: "Project name is required." });
    expect(buildCreateProjectPayload(input("a\tb"))).toEqual({
      ok: false,
      message: "Project name cannot contain control characters.",
    });
  });
});

describe("409 PROJECT_NAME_TAKEN", () => {
  function conflict(code: unknown, status = 409) {
    return new ApiError("conflict", status, { statusCode: status, code, message: "server text" });
  }

  it("is recognised by status and code, case-insensitively", () => {
    expect(isProjectNameTakenError(conflict("PROJECT_NAME_TAKEN"))).toBe(true);
    expect(isProjectNameTakenError(conflict("project_name_taken"))).toBe(true);
  });

  it("ignores other refusals and non-API errors", () => {
    expect(isProjectNameTakenError(conflict("SOMETHING_ELSE"))).toBe(false);
    expect(isProjectNameTakenError(conflict("PROJECT_NAME_TAKEN", 403))).toBe(false);
    expect(isProjectNameTakenError(conflict(undefined))).toBe(false);
    expect(isProjectNameTakenError(new ApiError("x", 409))).toBe(false);
    expect(isProjectNameTakenError(new Error("PROJECT_NAME_TAKEN"))).toBe(false);
    expect(isProjectNameTakenError(null)).toBe(false);
  });

  it("has the fixed message the field shows", () => {
    expect(PROJECT_NAME_TAKEN_MESSAGE).toBe(
      "A Project with this name already exists in this team. Choose another name.",
    );
  });
});

describe("wizard copy", () => {
  it("reads Adding to Project, with a fallback when the name is unknown", () => {
    expect(addingToProjectLine("loyalty")).toBe("Adding to Project: loyalty");
    expect(addingToProjectLine(null)).toBe("Adding to an existing Project");
    expect(addingToProjectLine("  ")).toBe("Adding to an existing Project");
  });

  it("labels the Review row", () => {
    expect(reviewProjectLabel(false, null, "  Checkout ")).toBe("Checkout");
    expect(reviewProjectLabel(true, "loyalty", "ignored")).toBe("loyalty");
    expect(reviewProjectLabel(true, null, "ignored")).toBe("Existing Project");
    expect(reviewProjectLabel(false, null, "")).toBe("Project name");
  });
});
