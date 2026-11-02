import type { ProjectDeploymentHistoryItem } from '@/shared/api/contracts';

/**
 * A complete deployment history item with neutral values. Tests pass only the
 * fields they assert on, so a field added to the type is added here once.
 */
export function deploymentHistoryItem(
  overrides: Partial<ProjectDeploymentHistoryItem> = {},
): ProjectDeploymentHistoryItem {
  return {
    id: 'deploy-1',
    targetId: 'target-1',
    targetName: 'web',
    provider: 'vercel',
    slot: 'frontend',
    environment: null,
    branch: 'main',
    commitSha: null,
    commitMessage: null,
    createdBy: null,
    status: 'ready',
    createdAt: '2026-10-12T10:00:00Z',
    readyAt: null,
    deploymentUrl: null,
    pullRequestNumber: null,
    inspectorUrl: null,
    dashboardUrl: '',
    consoleUrl: '',
    ...overrides,
  };
}
