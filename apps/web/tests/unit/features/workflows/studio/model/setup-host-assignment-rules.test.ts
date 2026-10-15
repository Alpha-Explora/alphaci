import {
  setupHostAssignmentProblems,
  setupHostAssignmentsProblem,
} from "../../../../../../src/features/workflows/studio/model/setup-host-assignment-rules";
import {
  ENVIRONMENT_TEMPLATE,
  type EnvironmentDraft,
} from "../../../../../../src/features/workflows/studio/model/project-environments-rules";

/**
 * Failure modes of the on-prem host assignments on the Delivery step:
 * - Production on a machine without an HTTPS URL, which the backend refuses;
 * - a machine on an environment that is not on-prem;
 * - a container port or health path the machine cannot serve.
 * Host ports are chosen by AlphaCI on the machine, so they are never checked here.
 */

const PRODUCTION = "Add an HTTPS URL for Production, or choose Assign later.";

/** The fixed dev, uat, main path, every environment on-prem. */
function onprem(): EnvironmentDraft[] {
  return ENVIRONMENT_TEMPLATE.map((environment) => ({
    ...environment,
    runsOn: "onprem",
  }));
}

/** An environment assigned to a machine, with one container port and the root health path. */
function assigned(
  environment: EnvironmentDraft,
  overrides: {
    containerPort?: number;
    healthPath?: string | null;
    publicUrl?: string | null;
  } = {},
): EnvironmentDraft {
  return {
    ...environment,
    hostAssignment: {
      requestId: "request-1",
      config: {
        ports: [
          { slot: "backend", containerPort: overrides.containerPort ?? 4000 },
        ],
        health: [{ slot: "backend", path: overrides.healthPath ?? "/" }],
        ingress: {
          mode: overrides.publicUrl ? "configured" : "direct",
          publicUrl: overrides.publicUrl ?? null,
        },
      },
    },
  };
}

describe("setupHostAssignmentsProblem", () => {
  it("has no problem while every environment is left on Assign later", () => {
    expect(setupHostAssignmentsProblem(onprem())).toBeNull();
    expect(setupHostAssignmentsProblem([])).toBeNull();
  });

  it("has no problem for a non-production environment with no HTTPS URL", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([assigned(dev!), assigned(uat!), main!]),
    ).toBeNull();
  });

  it("names Production that has a machine but no HTTPS URL, with the fix", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([dev!, uat!, assigned(main!, { publicUrl: null })]),
    ).toBe(PRODUCTION);
  });

  it("refuses an http URL for Production: only https counts", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([
        dev!,
        uat!,
        assigned(main!, { publicUrl: "http://ledger.example.com" }),
      ]),
    ).toBe(PRODUCTION);
  });

  it("accepts Production with an HTTPS URL", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([
        dev!,
        uat!,
        assigned(main!, { publicUrl: "https://ledger.example.com" }),
      ]),
    ).toBeNull();
  });

  it("refuses a machine on an environment that is not on-prem", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([
        assigned({ ...dev!, runsOn: "managed" }),
        uat!,
        main!,
      ]),
    ).toBe("Assign machines only to on-prem environments.");
  });

  it("refuses a container port outside 1 to 65535", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([assigned(dev!, { containerPort: 70000 }), uat!, main!]),
    ).toBe("Use whole container port numbers from 1 to 65535.");
    expect(
      setupHostAssignmentsProblem([assigned(dev!, { containerPort: Number.NaN }), uat!, main!]),
    ).toBe("Use whole container port numbers from 1 to 65535.");
  });

  it("refuses a health path that is not an application path", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([assigned(dev!, { healthPath: "health" }), uat!, main!]),
    ).toBe("Enter an application health path, or choose Assign later.");
    expect(
      setupHostAssignmentsProblem([
        assigned(dev!, { healthPath: "//evil.example.com" }),
        uat!,
        main!,
      ]),
    ).toBe("Enter an application health path, or choose Assign later.");
  });

  it("names the first problem in promotion order", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentsProblem([
        assigned(dev!, { healthPath: "health" }),
        uat!,
        assigned(main!, { publicUrl: null }),
      ]),
    ).toBe("Enter an application health path, or choose Assign later.");
  });
});

describe("setupHostAssignmentProblems", () => {
  it("gives one entry per environment, so each can name its own problem", () => {
    const [dev, uat, main] = onprem();
    expect(
      setupHostAssignmentProblems([
        assigned(dev!, { healthPath: "health" }),
        uat!,
        assigned(main!, { publicUrl: null }),
      ]),
    ).toEqual([
      "Enter an application health path, or choose Assign later.",
      null,
      PRODUCTION,
    ]);
  });

  it("is empty for an empty list", () => {
    expect(setupHostAssignmentProblems([])).toEqual([]);
  });
});
