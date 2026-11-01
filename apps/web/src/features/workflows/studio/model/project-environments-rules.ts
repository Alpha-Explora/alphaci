/**
 * The ordered environments a new single-repository project is created with.
 *
 * The first environment deploys on every push to its branch; each later one
 * receives a release only by promotion from the one before it. Several
 * environments may share a branch. Exactly one is production. The rules below
 * mirror the backend's, so a list it would refuse is caught before the
 * repository exists; the backend stays the authority.
 */

export type EnvironmentDraftRole = "production" | "non_production";

/** Where an environment runs. Absent means managed hosting, today's default. */
export type EnvironmentRunsOn = "managed" | "onprem";

export interface EnvironmentDraft {
  hostAssignment?: {
    /** Omitted: the workspace's only connected machine. */
    machineId?: string;
    requestId: string;
    config: import("@/shared/api/contracts").OnpremAssignmentRequestConfig;
  };
  slug: string;
  displayName: string;
  sourceBranch: string;
  role: EnvironmentDraftRole;
  /**
   * Wizard-only: never sent as an environment field. It travels with the row
   * through reorder and remove, and becomes on-prem deployment targets.
   */
  runsOn?: EnvironmentRunsOn;
}

/** The editable starting point: test and UAT, then production. */
export const ENVIRONMENT_TEMPLATE: readonly EnvironmentDraft[] = [
  {
    slug: "dev",
    displayName: "Test",
    sourceBranch: "dev",
    role: "non_production",
  },
  {
    slug: "uat",
    displayName: "UAT",
    sourceBranch: "uat",
    role: "non_production",
  },
  {
    slug: "main",
    displayName: "Production",
    sourceBranch: "main",
    role: "production",
  },
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Why the list cannot be created, or null. */
export function environmentsProblem(
  environments: readonly EnvironmentDraft[],
): string | null {
  if (environments.length === 0) return "Add at least one environment.";
  const slugs = new Set<string>();
  for (const environment of environments) {
    const problem = environmentProblem(environment);
    if (problem) return problem;
    if (slugs.has(environment.slug)) {
      return "Two environments are named " + environment.slug + ".";
    }
    slugs.add(environment.slug);
  }
  const production = environments.filter(({ role }) => role === "production");
  return production.length === 1
    ? null
    : "Mark exactly one environment as production.";
}

function environmentProblem(environment: EnvironmentDraft): string | null {
  if (!SLUG.test(environment.slug)) {
    return (
      "Environment ID " +
      (environment.slug || "(empty)") +
      " must be lowercase letters, digits, and single hyphens."
    );
  }
  if (!environment.displayName.trim()) {
    return "Environment " + environment.slug + " needs a display name.";
  }
  if (!environment.sourceBranch.trim()) {
    return "Environment " + environment.slug + " needs a source branch.";
  }
  return null;
}

/** The branches creation will make, in the order environments use them. */
export function environmentBranches(
  environments: readonly EnvironmentDraft[],
): string[] {
  return [
    ...new Set(
      environments
        .map(({ sourceBranch }) => sourceBranch.trim())
        .filter(Boolean),
    ),
  ];
}

export function updateEnvironment(
  environments: readonly EnvironmentDraft[],
  index: number,
  change: Partial<Omit<EnvironmentDraft, "role">>,
): EnvironmentDraft[] {
  return environments.map((environment, position) =>
    position === index ? { ...environment, ...change } : environment,
  );
}

/** Make one environment production; every other one becomes non-production. */
export function makeProduction(
  environments: readonly EnvironmentDraft[],
  index: number,
): EnvironmentDraft[] {
  return environments.map((environment, position) => ({
    ...environment,
    role: position === index ? "production" : "non_production",
  }));
}

export function moveEnvironment(
  environments: readonly EnvironmentDraft[],
  index: number,
  offset: -1 | 1,
): EnvironmentDraft[] {
  const target = index + offset;
  if (target < 0 || target >= environments.length) return [...environments];
  const moved = [...environments];
  [moved[index], moved[target]] = [moved[target]!, moved[index]!];
  return moved;
}

export function removeEnvironment(
  environments: readonly EnvironmentDraft[],
  index: number,
): EnvironmentDraft[] {
  return environments.filter((_, position) => position !== index);
}

/**
 * Add a non-production environment just before production, sharing the
 * branch of the environment it follows, with an unused ID.
 */
export function addEnvironment(
  environments: readonly EnvironmentDraft[],
): EnvironmentDraft[] {
  const productionIndex = environments.findIndex(
    ({ role }) => role === "production",
  );
  const at = productionIndex === -1 ? environments.length : productionIndex;
  const slug = unusedSlug(environments);
  const added: EnvironmentDraft = {
    slug,
    displayName: "Stage " + slug.replace(/^stage-?/, ""),
    sourceBranch: environments[at - 1]?.sourceBranch ?? "dev",
    role: "non_production",
  };
  return [...environments.slice(0, at), added, ...environments.slice(at)];
}

function unusedSlug(environments: readonly EnvironmentDraft[]): string {
  const taken = new Set(environments.map(({ slug }) => slug));
  let number = 1;
  while (taken.has("stage-" + String(number))) number += 1;
  return "stage-" + String(number);
}
