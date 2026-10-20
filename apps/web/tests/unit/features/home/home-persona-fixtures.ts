import type {
  FolderRepository,
  ProjectFolder,
  ProjectFoldersSnapshot,
  ProvisionedProject,
  RunGroup,
  StageStatus,
  TeamQaOverview,
  TeamQaProject,
} from "../../../../src/features/home/model/home-types";

/* One small team, read by every Home test:
 *   Storefront (dp-shop): shop-fe + shop-be, 2 Features, an open QA run,
 *     items returned to development; the viewer is its Developer.
 *   Payments (dp-pay): pay-be, 0 Features, signed off Approved and not
 *     merged yet; no Developer members; the viewer is its QA.
 *   Loyalty (dp-new): no repositories and no run. */

export function repository(
  name: string,
  projectId: string | null,
  role: "frontend" | "backend" = "backend",
): FolderRepository {
  return {
    repositoryId: `repo-${name}`,
    name,
    repoFullName: `acme/${name}`,
    status: "active",
    project: projectId ? { id: projectId, role, status: "provisioned", repoShape: null } : null,
  };
}

export function folder(overrides: Partial<ProjectFolder> & Pick<ProjectFolder, "deliveryProjectId" | "name">): ProjectFolder {
  return { systemId: "sys-1", createdAt: null, featureCount: 1, repositories: [], ...overrides };
}

export const FOLDERS: ProjectFolder[] = [
  folder({
    deliveryProjectId: "dp-shop",
    name: "Storefront",
    featureCount: 2,
    repositories: [repository("shop-be", "p-shop-be"), repository("shop-fe", "p-shop-fe", "frontend")],
  }),
  folder({ deliveryProjectId: "dp-pay", name: "Payments", featureCount: 0, repositories: [repository("pay-be", "p-pay-be")] }),
  folder({ deliveryProjectId: "dp-new", name: "Loyalty", featureCount: 1 }),
];

export function snapshot(
  folders: ProjectFolder[] = FOLDERS,
  flags: Partial<Pick<ProjectFoldersSnapshot, "canCreateProject" | "canCreateRepository">> = {},
): ProjectFoldersSnapshot {
  return {
    groupId: "ws-1",
    canManage: false,
    canCreateProject: null,
    canCreateRepository: null,
    folders,
    unfiled: [],
    ...flags,
  };
}

const NO_COUNTS = { readyForQa: null, openDefects: null, members: null };

export function qaProject(
  id: string,
  name: string,
  overrides: Partial<Omit<TeamQaProject, "deliveryProject">> = {},
): TeamQaProject {
  return {
    deliveryProject: { id, name },
    requirements: [],
    latestRun: null,
    counts: NO_COUNTS,
    promotion: null,
    viewerMembership: null,
    iteration: null,
    ...overrides,
  };
}

export function requirementSummary(
  verification: Partial<NonNullable<TeamQaProject["requirements"][number]["verification"]>> | null,
  overrides: Partial<TeamQaProject["requirements"][number]> = {},
): TeamQaProject["requirements"][number] {
  return {
    id: overrides.id ?? "req-1",
    kind: "functional",
    name: "Feature",
    itemCount: 5,
    progressCounts: { todo: 1, in_progress: 1, done: 3 },
    verification: verification
      ? { pending: 0, passed: 0, failed: 0, blocked: 0, returned_to_dev: 0, ...verification }
      : null,
    latestRunStatus: verification ? "open" : null,
    archivedAt: null,
    ...overrides,
  };
}

export const SHOP = qaProject("dp-shop", "Storefront", {
  requirements: [
    requirementSummary({ pending: 2, passed: 3, failed: 1, blocked: 1, returned_to_dev: 2 }),
    // Archived: never counted.
    requirementSummary({ returned_to_dev: 9 }, { id: "req-old", archivedAt: "2026-09-01T00:00:00Z" }),
  ],
  latestRun: { id: "run-shop", status: "open", createdAt: null, verdict: null, signedOffAt: null, signedOffBy: null },
  counts: { readyForQa: 2, openDefects: { blocker: 1, major: 0, minor: 2, unrated: 0 }, members: { developer: 1, qa: 1 } },
  promotion: { mergedRepositories: 0, totalRepositories: 2, lastMergedAt: null },
  viewerMembership: "developer",
});

export const PAY = qaProject("dp-pay", "Payments", {
  requirements: [requirementSummary({ passed: 5 }, { id: "req-pay", latestRunStatus: "signed_off" })],
  latestRun: {
    id: "run-pay",
    status: "signed_off",
    createdAt: null,
    verdict: "APPROVED",
    signedOffAt: "2026-10-12T12:00:00Z",
    signedOffBy: "ana-qa",
  },
  counts: { readyForQa: 0, openDefects: { blocker: 0, major: 1, minor: 0, unrated: 1 }, members: { developer: 0, qa: 1 } },
  promotion: { mergedRepositories: 0, totalRepositories: 1, lastMergedAt: null },
  viewerMembership: "qa",
});

export const LOYALTY = qaProject("dp-new", "Loyalty", {
  counts: { readyForQa: 0, openDefects: { blocker: 0, major: 0, minor: 0, unrated: 0 }, members: { developer: 2, qa: 0 } },
  promotion: { mergedRepositories: 0, totalRepositories: 0, lastMergedAt: null },
});

const ALL_SUPPORTED = { latestRun: true, counts: true, promotion: true, viewerMembership: true };

export function overview(
  projects: TeamQaProject[] = [SHOP, PAY, LOYALTY],
  supports: Partial<TeamQaOverview["supports"]> = {},
): TeamQaOverview {
  return { projects, supports: { ...ALL_SUPPORTED, ...supports } };
}

/** The same Projects as an older backend sends them: no latestRun, counts, promotion or membership. */
export function olderOverview(): TeamQaOverview {
  const strip = (project: TeamQaProject): TeamQaProject => ({
    ...project,
    latestRun: null,
    counts: NO_COUNTS,
    promotion: null,
    viewerMembership: null,
    iteration: null,
  });
  return {
    projects: [SHOP, PAY, LOYALTY].map(strip),
    supports: { latestRun: false, counts: false, promotion: false, viewerMembership: false },
  };
}

export function run(
  repo: string,
  branch: string,
  overallStatus: RunGroup["overallStatus"],
  startedAt: string,
  verify?: { status: StageStatus; tests?: { passed: number; failed: number; total: number } },
): RunGroup {
  const stages = verify
    ? [
        {
          stage: "verify" as const,
          status: verify.status,
          runId: 1,
          friendlyMessages: [],
          githubRunUrl: "",
          updatedAt: startedAt,
          results: verify.tests ? { tests: verify.tests } : undefined,
        },
      ]
    : [];
  return {
    runId: Math.floor(Date.parse(startedAt) / 1000),
    repoFullName: `acme/${repo}`,
    branch,
    commitSha: "abcdef1234567",
    startedAt,
    overallStatus,
    stages,
  };
}

/** Newest first, as the server sends them. */
export const RUNS: RunGroup[] = [
  run("shop-fe", "dev", "failure", "2026-10-13T10:00:00Z"),
  run("pay-be", "dev", "running", "2026-10-13T09:00:00Z"),
  run("shop-fe", "uat", "success", "2026-10-13T08:00:00Z", { status: "success", tests: { passed: 48, failed: 0, total: 48 } }),
  run("pay-be", "uat", "failure", "2026-10-13T07:00:00Z", { status: "failure", tests: { passed: 3, failed: 2, total: 5 } }),
  run("shop-fe", "dev", "failure", "2026-10-13T06:00:00Z"),
  run("shop-be", "main", "success", "2026-10-13T05:00:00Z"),
  run("other-api", "uat", "success", "2026-10-13T04:00:00Z"),
];

export const PROVISIONED: ProvisionedProject[] = [
  { id: "p-other", repoFullName: "acme/other-api", serviceName: "other-api", status: "provisioned" } as ProvisionedProject,
];
