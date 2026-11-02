import type { ProjectBranchPreview } from '@/shared/api/contracts';

/**
 * A complete preview with neutral values. Tests pass only the fields they
 * assert on, so a field added to ProjectBranchPreview is added here once.
 */
export function branchPreview(
  overrides: Partial<ProjectBranchPreview> = {},
): ProjectBranchPreview {
  return {
    branch: 'main',
    isProduction: false,
    deploymentId: 'dpl_1',
    targetId: 'target-1',
    targetName: 'web',
    provider: 'vercel',
    slot: 'frontend',
    surface: 'page',
    providerLabel: 'Vercel',
    logsAvailable: false,
    logWindow: null,
    status: 'ready',
    commitSha: null,
    commitMessage: null,
    pullRequestNumber: null,
    createdBy: null,
    trigger: null,
    previewUrl: null,
    deploymentUrl: null,
    inspectorUrl: null,
    createdAt: null,
    startedAt: null,
    readyAt: null,
    recentDeploys: [],
    embeddable: null,
    embedBlockedReason: null,
    ...overrides,
  };
}
