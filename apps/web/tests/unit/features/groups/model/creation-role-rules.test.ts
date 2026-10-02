import {
  canCreateProjectFolder,
  canCreateRepositoryInProject,
  canCreateRepositoryWithoutProject,
  creationRefusalMessage,
  readFeatureCount,
  repositoryBlockedByFeatures,
  repositoryRequiresProject,
  resolveCanCreateProject,
  resolveCanCreateRepository,
} from "../../../../../src/features/groups/model/creation-role-rules";
import { ApiError } from "../../../../../src/shared/api/request";

const ROLES = ["admin", "lead", "member", "qa", "owner", "", null, undefined] as const;

function table(expected: Record<string, boolean>) {
  return ROLES.map((role) => [role, expected[String(role)] ?? false] as const);
}

describe("creation role rules", () => {
  it.each(table({ admin: true, lead: true }))("canCreateProjectFolder(%p) is %p", (role, expected) => {
    expect(canCreateProjectFolder(role as never)).toBe(expected);
  });

  it.each(table({ admin: true, member: true }))(
    "canCreateRepositoryInProject(%p) is %p",
    (role, expected) => {
      expect(canCreateRepositoryInProject(role as never)).toBe(expected);
    },
  );

  it.each(table({ admin: true }))("canCreateRepositoryWithoutProject(%p) is %p", (role, expected) => {
    expect(canCreateRepositoryWithoutProject(role as never)).toBe(expected);
  });

  it.each(table({ member: true }))("repositoryRequiresProject(%p) is %p", (role, expected) => {
    expect(repositoryRequiresProject(role as never)).toBe(expected);
  });

  it("never lets a lead or QA create a repository", () => {
    for (const role of ["lead", "qa"] as const) {
      expect(canCreateRepositoryInProject(role)).toBe(false);
      expect(canCreateRepositoryWithoutProject(role)).toBe(false);
    }
  });
});

describe("resolveCanCreateProject", () => {
  it("takes the server's exact boolean over the role", () => {
    expect(resolveCanCreateProject(false, "lead")).toBe(false);
    expect(resolveCanCreateProject(true, "member")).toBe(true);
  });

  it.each([undefined, null, "true", 1])("falls back to the role when the flag is %p", (flag) => {
    expect(resolveCanCreateProject(flag, "lead")).toBe(true);
    expect(resolveCanCreateProject(flag, "admin")).toBe(true);
    expect(resolveCanCreateProject(flag, "member")).toBe(false);
    expect(resolveCanCreateProject(flag, "qa")).toBe(false);
    expect(resolveCanCreateProject(flag, undefined)).toBe(false);
  });
});

describe("resolveCanCreateRepository", () => {
  it("takes the server's exact boolean over the role", () => {
    expect(resolveCanCreateRepository(false, "member")).toBe(false);
    expect(resolveCanCreateRepository(true, "lead")).toBe(true);
  });

  it.each([undefined, null, "true", 1])("falls back to the role when the flag is %p", (flag) => {
    expect(resolveCanCreateRepository(flag, "member")).toBe(true);
    expect(resolveCanCreateRepository(flag, "admin")).toBe(true);
    expect(resolveCanCreateRepository(flag, "lead")).toBe(false);
    expect(resolveCanCreateRepository(flag, "qa")).toBe(false);
    expect(resolveCanCreateRepository(flag, undefined)).toBe(false);
  });
});

describe("Features before repositories", () => {
  it.each([
    [0, 0],
    [3, 3],
    [undefined, null],
    [null, null],
    [-1, null],
    [1.5, null],
    ["2", null],
  ])("readFeatureCount(%p) is %p", (value, expected) => {
    expect(readFeatureCount(value)).toBe(expected);
  });

  it("blocks a Developer (and any unnamed role) from a Project with exactly 0 Features", () => {
    expect(repositoryBlockedByFeatures("member", 0)).toBe(true);
    expect(repositoryBlockedByFeatures("lead", 0)).toBe(true);
    expect(repositoryBlockedByFeatures("qa", 0)).toBe(true);
    expect(repositoryBlockedByFeatures(undefined, 0)).toBe(true);
    expect(repositoryBlockedByFeatures("owner" as never, 0)).toBe(true);
  });

  it("exempts admins, and never blocks once a Feature exists", () => {
    expect(repositoryBlockedByFeatures("admin", 0)).toBe(false);
    expect(repositoryBlockedByFeatures("member", 1)).toBe(false);
  });

  it("leaves an unknown count to the server", () => {
    expect(repositoryBlockedByFeatures("member", null)).toBe(false);
  });
});

describe("creationRefusalMessage", () => {
  const refusal = (status: number, code: string) =>
    new ApiError(`HTTP ${status}`, status, { code, message: "server text" });

  it.each([
    [403, "PROJECT_CREATE_FORBIDDEN", "Product owners create Projects."],
    [403, "REPOSITORY_CREATE_FORBIDDEN", "Developers create repositories inside a Project."],
    [400, "PROJECT_REQUIRED", "Choose the Project this repository belongs to."],
    [400, "project_required", "Choose the Project this repository belongs to."],
    [409, "PROJECT_FEATURES_REQUIRED", "Waiting for your Product owner to add the first Feature."],
  ])("maps %s %s", (status, code, expected) => {
    expect(creationRefusalMessage(refusal(status, code))).toBe(expected);
  });

  it("leaves anything else to the caller", () => {
    expect(creationRefusalMessage(refusal(403, "OTHER"))).toBeNull();
    expect(creationRefusalMessage(new ApiError("HTTP 500", 500))).toBeNull();
    expect(creationRefusalMessage(new TypeError("boom"))).toBeNull();
    expect(creationRefusalMessage(null)).toBeNull();
  });
});
