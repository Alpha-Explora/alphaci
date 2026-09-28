import { buildCreateProjectPayload } from "../../../../../../src/features/workflows/studio/model/create-project-payload";
import {
  ENVIRONMENT_TEMPLATE,
  addEnvironment,
  environmentBranches,
  environmentsProblem,
  makeProduction,
  moveEnvironment,
  removeEnvironment,
  updateEnvironment,
  type EnvironmentDraft,
} from "../../../../../../src/features/workflows/studio/model/project-environments-rules";

/**
 * Failure modes of creating a project with its own environments:
 * - a list the backend refuses is sent after the user filled in the form;
 * - editing leaves no production, or two;
 * - an added environment lands after production or reuses an ID;
 * - the branch preview lists a shared branch twice;
 * - environments leak into shapes the backend rejects them for, or are sent
 *   when the user never turned them on.
 */

const template = (): EnvironmentDraft[] => [...ENVIRONMENT_TEMPLATE];

const payloadInput = {
  repoName: "shop",
  visibility: "private" as const,
  serviceName: "shop",
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
  repoShapeId: "single",
  projectTypeId: "nestjs",
  workflowRecipeId: "standard",
  tests: { lint: true, unit: true, build: true, coverage: true, security: true, docker: true },
};

describe("project environment rules", () => {
  it("accepts the template and refuses what the backend would", () => {
    expect(environmentsProblem(template())).toBeNull();
    expect(environmentsProblem([])).toMatch(/at least one/);
    expect(
      environmentsProblem(updateEnvironment(template(), 1, { slug: "dev" })),
    ).toMatch(/Two environments are named dev/);
    expect(
      environmentsProblem(updateEnvironment(template(), 0, { slug: "Dev Env" })),
    ).toMatch(/lowercase/);
    expect(
      environmentsProblem(updateEnvironment(template(), 2, { sourceBranch: " " })),
    ).toMatch(/source branch/);
    expect(environmentsProblem(removeEnvironment(template(), 2))).toMatch(
      /exactly one environment as production/,
    );
  });

  it("keeps exactly one production when production moves", () => {
    const moved = makeProduction(template(), 1);
    expect(moved.map(({ role }) => role)).toEqual([
      "non_production",
      "production",
      "non_production",
    ]);
    expect(environmentsProblem(moved)).toBeNull();
  });

  it("adds a new environment before production with an unused ID and reorders", () => {
    const added = addEnvironment(addEnvironment(template()));
    expect(added.map(({ slug }) => slug)).toEqual([
      "dev",
      "uat",
      "stage-1",
      "stage-2",
      "main",
    ]);
    expect(added[2]!.sourceBranch).toBe("uat");
    expect(moveEnvironment(added, 0, -1).map(({ slug }) => slug)[0]).toBe("dev");
    expect(moveEnvironment(added, 0, 1).map(({ slug }) => slug).slice(0, 2)).toEqual([
      "uat",
      "dev",
    ]);
  });

  it("previews each shared branch once, in order", () => {
    const shared = updateEnvironment(template(), 1, { sourceBranch: "dev" });
    expect(environmentBranches(shared)).toEqual(["dev", "main"]);
  });

  it("sends trimmed environments only for a single repository that turned them on", () => {
    const withEnvironments = buildCreateProjectPayload({
      ...payloadInput,
      environments: updateEnvironment(template(), 0, { displayName: " Test " }),
    });
    expect(withEnvironments).toMatchObject({
      ok: true,
      payload: { environments: [{ slug: "dev", displayName: "Test" }, {}, {}] },
    });

    const refused = buildCreateProjectPayload({
      ...payloadInput,
      environments: makeProduction(removeEnvironment(template(), 2), 5),
    });
    expect(refused).toEqual({
      ok: false,
      message: "Mark exactly one environment as production.",
    });

    const off = buildCreateProjectPayload(payloadInput);
    expect(off.ok && "environments" in off.payload).toBe(false);

    const microservices = buildCreateProjectPayload({
      ...payloadInput,
      isMicroservicesShape: true,
      environments: template(),
    });
    expect(microservices.ok && "environments" in microservices.payload).toBe(false);
  });
});
