import {
  canManageEnvVars,
  canManageHosting,
  canManageProjectLifecycle,
  canOpenQaStudio,
  canReinstallDeploymentSecrets,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

const NON_LEAD_ROLES: ReadonlyArray<AppRole> = ["qa", "member"];

/** Phase 1 security gates: the allow-lists behind three of the four new rules. */
describe("canManageEnvVars", () => {
  it("allows only Developers and Admins — the backend's env-var allow-list (ENV_VARS_LEAD_ONLY)", () => {
    expect(canManageEnvVars("admin")).toBe(true);
    expect(canManageEnvVars("member")).toBe(true);
    expect(canManageEnvVars("lead")).toBe(false);
    expect(canManageEnvVars("qa")).toBe(false);
  });

  it("denies a session with no known role", () => {
    expect(canManageEnvVars(undefined)).toBe(false);
    expect(canManageEnvVars(null)).toBe(false);
  });
});

describe("canManageProjectLifecycle", () => {
  it("allows only Team leads and Admins — the backend's PROJECT_ROLE_FORBIDDEN allow-list", () => {
    expect(canManageProjectLifecycle("admin")).toBe(true);
    expect(canManageProjectLifecycle("lead")).toBe(true);
    for (const role of NON_LEAD_ROLES) {
      expect(canManageProjectLifecycle(role)).toBe(false);
    }
  });

  it("denies a session with no known role", () => {
    expect(canManageProjectLifecycle(undefined)).toBe(false);
    expect(canManageProjectLifecycle(null)).toBe(false);
  });

  it("no longer decides reinstalling deployment secrets, which follows the hosting rule", () => {
    for (const role of ["admin", "lead", "qa", "member", null, undefined] as const) {
      expect(canReinstallDeploymentSecrets(role)).toBe(canManageHosting(role));
    }
    expect(canReinstallDeploymentSecrets("member")).toBe(true);
    expect(canReinstallDeploymentSecrets("lead")).toBe(false);
  });
});

describe("canOpenQaStudio", () => {
  it("matches QA Studio's own visibility rule: qa and admin (a Product owner has PO Studio)", () => {
    for (const role of ["qa", "admin"] as const) {
      expect(canOpenQaStudio(role)).toBe(true);
    }
    expect(canOpenQaStudio("lead")).toBe(false);
  });

  it("excludes Developer and a session with no known role", () => {
    expect(canOpenQaStudio("member")).toBe(false);
    expect(canOpenQaStudio(undefined)).toBe(false);
    expect(canOpenQaStudio(null)).toBe(false);
  });
});
