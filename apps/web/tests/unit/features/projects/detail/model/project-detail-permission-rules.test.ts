import {
  canManageEnvVars,
  canManageProjectLifecycle,
  canOpenQaStudio,
  canReinstallDeploymentSecrets,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

const NON_LEAD_ROLES: ReadonlyArray<AppRole> = ["qa", "member"];

/** Phase 1 security gates: the allow-lists behind three of the four new rules. */
describe("canManageEnvVars", () => {
  it("allows only Team leads and Admins — the backend's ENV_VARS_LEAD_ONLY allow-list", () => {
    expect(canManageEnvVars("admin")).toBe(true);
    expect(canManageEnvVars("lead")).toBe(true);
    for (const role of NON_LEAD_ROLES) {
      expect(canManageEnvVars(role)).toBe(false);
    }
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

  it("shares its allow-list with the existing reinstall-secrets gate", () => {
    // Both mirror the same backend code (PROJECT_ROLE_FORBIDDEN); this pins
    // them to the same answer for every role so they cannot drift silently.
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      expect(canManageProjectLifecycle(role)).toBe(canReinstallDeploymentSecrets(role));
    }
  });
});

describe("canOpenQaStudio", () => {
  it("matches QA Studio's own visibility rule: qa, lead and admin", () => {
    for (const role of ["qa", "lead", "admin"] as const) {
      expect(canOpenQaStudio(role)).toBe(true);
    }
  });

  it("excludes Developer and a session with no known role", () => {
    expect(canOpenQaStudio("member")).toBe(false);
    expect(canOpenQaStudio(undefined)).toBe(false);
    expect(canOpenQaStudio(null)).toBe(false);
  });
});
