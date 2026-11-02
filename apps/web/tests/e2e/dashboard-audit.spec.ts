import { test, type Page } from '@playwright/test';

import { expectVisibleText, json, text } from './support';

/* Dashboard audit: an admin's Projects, project detail and Settings render
 * against a mocked backend with no failed request and no console error.
 *
 * Stale: its fixtures predate project folders, and the tabs and Billing page
 * it walks are gone. Its checks (Pipeline configuration, Hosting variables,
 * Audit, Settings) move into qa-journeys.ts on its contract-shaped mock, and
 * this file is deleted. */

const sessionUser = {
  id: 'user-1',
  login: 'tone',
  name: 'Tone Builder',
  avatarUrl: null,
  email: 'tone@example.test',
  onboardingCompleted: true,
};

const subscription = {
  plan: 'pro',
  status: 'active',
  provider: 'manual',
  updatedAt: '2026-06-15T00:00:00.000Z',
};

const deploymentTarget = {
  id: 'target-1',
  projectId: 'project-1',
  slot: 'backend',
  ownershipMode: 'flowci_managed',
  provider: 'render',
  providerConnectionId: null,
  providerProjectId: 'srv-1',
  providerProjectName: 'orders-api-test',
  repoFullName: 'tone/orders-api',
  branchName: 'test',
  rootDirectory: '.',
  buildCommand: 'npm run build',
  startCommand: 'npm run start:prod',
  renderEnvironmentName: 'test',
  environmentMap: {},
  providerMetadata: {},
  status: 'active',
};

const project = {
  id: 'project-1',
  repoFullName: 'tone/orders-api',
  templateId: 'be-nestjs',
  serviceName: 'orders-api',
  workflowPath: '.github/workflows/00-alphaci-access.yml',
  workflowFiles: [
    {
      stage: 'access',
      name: 'ALPHACI Access Gate',
      path: '.github/workflows/00-alphaci-access.yml',
      gated: true,
    },
    {
      stage: 'quality',
      name: 'ALPHACI Quality',
      path: '.github/workflows/10-alphaci-quality.yml',
      gated: true,
    },
    {
      stage: 'package',
      name: 'ALPHACI Package',
      path: '.github/workflows/20-alphaci-package.yml',
      gated: true,
    },
  ],
  status: 'provisioned',
  githubCommitSha: 'abc123',
  githubCommitUrl: 'https://github.com/tone/orders-api/commit/abc123',
  repoUrl: 'https://github.com/tone/orders-api',
  failureReason: null,
  visibility: 'private',
  repoShape: 'single',
  projectTypeId: 'nestjs-api',
  workflowRecipeId: 'backend-api-ci',
  projectOptions: {},
};

const workflowSettings = {
  projectId: 'project-1',
  templateId: 'be-nestjs',
  projectTypeId: 'nestjs-api',
  workflowRecipeId: 'backend-api-ci',
  serviceName: 'orders-api',
  servicePath: '.',
  nodeVersion: '24',
  packageManager: 'npm',
  coverageThreshold: 80,
  centralWorkflowRef: 'v1',
  checks: {
    lint: true,
    unit: true,
    build: true,
    security: true,
  },
};

async function installDashboardAuditApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');

    if (path === '/auth/me') {
      return json(route, {
        authenticated: true,
        user: sessionUser,
        subscription,
        // An admin, so /workflows offers "Create project".
        appRole: 'admin',
      });
    }

    if (path === '/groups') {
      return json(route, [
        {
          id: 'workspace-1',
          name: 'Design team',
          description: 'Projects owned by the design team.',
          status: 'active',
        },
      ]);
    }

    if (path === '/capabilities') {
      return json(route, {
        envProvisioning: {
          enabled: true,
          providers: ['render', 'vercel'],
          environments: ['test', 'uat', 'production'],
          modes: ['byo', 'flowci_managed'],
        },
        projectSyncSnapshots: { enabled: true, mode: 'local_snapshot' },
        workflowSettingsPreview: { enabled: true },
        workflowUpdatePr: { enabled: true },
        projectTargetManagement: { enabled: true },
        ciRunTracking: {
          enabled: true,
          liveGithubEnabled: false,
          mode: 'local_mock',
        },
        deploymentHistory: {
          enabled: true,
          liveProvidersEnabled: false,
          mode: 'local_mock',
        },
        driftDetection: { enabled: true, mode: 'local_snapshot' },
        driftRepair: { enabled: true, mode: 'local_safe' },
        usageQuotas: { enabled: true },
        workspaces: { enabled: true },
        auditEvents: { enabled: true },
        notifications: { enabled: true },
      });
    }

    if (path === '/workspaces/me') {
      return json(route, {
        enabled: true,
        items: [
          {
            id: 'workspace-1',
            name: 'Design team',
            kind: 'personal',
            role: 'admin',
          },
        ],
      });
    }

    if (path === '/workspaces/workspace-1/members') {
      return json(route, [
        {
          id: 'member-1',
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'admin',
          login: 'tone',
          name: 'Tone Builder',
          email: 'tone@example.test',
          avatarUrl: null,
          createdAt: '2026-06-15T00:00:00.000Z',
        },
      ]);
    }

    if (path === '/notifications') {
      return json(route, {
        enabled: true,
        unreadCount: 1,
        items: [
          {
            id: 'notification-1',
            title: 'Project created',
            body: 'tone/orders-api is now tracked by ALPHACI.',
            eventCode: 'project_created',
            readAt: null,
            createdAt: '2026-06-15T00:00:00.000Z',
          },
        ],
      });
    }

    if (path === '/notifications/preferences') {
      return json(route, {
        userId: 'user-1',
        inAppEnabled: true,
        emailEnabled: false,
        updatedAt: '2026-06-15T00:00:00.000Z',
      });
    }

    if (path === '/usage/me') {
      return json(route, {
        enabled: true,
        plan: 'pro',
        items: [
          { code: 'projects', current: 1, limit: 50, upgradeRequired: false },
          {
            code: 'deployment_targets',
            current: 1,
            limit: 100,
            upgradeRequired: false,
          },
          {
            code: 'managed_render_services',
            current: 1,
            limit: 10,
            upgradeRequired: false,
          },
          {
            code: 'managed_vercel_projects',
            current: 0,
            limit: 10,
            upgradeRequired: false,
          },
          { code: 'env_keys', current: 2, limit: 500, upgradeRequired: false },
          {
            code: 'workflow_prs',
            current: 0,
            limit: 100,
            upgradeRequired: false,
          },
        ],
      });
    }

    if (path === '/projects') {
      return json(route, { items: [project] });
    }

    if (path === '/projects/project-1/overview') {
      return json(route, {
        project: {
          ...project,
          createdAt: '2026-06-15T00:00:00.000Z',
          updatedAt: '2026-06-15T00:00:00.000Z',
        },
        workflow: {
          path: project.workflowPath,
          files: project.workflowFiles,
          stageCount: project.workflowFiles.length,
          history: [],
        },
        deploymentTargets: { items: [deploymentTarget], count: 1 },
        environment: {
          items: [
            {
              id: 'env-1',
              projectId: 'project-1',
              deploymentTargetId: 'target-1',
              environment: 'test',
              key: 'DATABASE_URL',
              provider: 'render',
              valueStored: false,
              lastProvisionedAt: '2026-06-15T00:00:00.000Z',
              lastProvisionedBy: 'user-1',
              status: 'provisioned',
              errorSummary: null,
            },
          ],
          count: 1,
          failedCount: 0,
        },
        ciAuth: {
          status: 'active',
          tokenPresent: true,
          tokenPrefix: 'aci_test',
          createdAt: '2026-06-15T00:00:00.000Z',
          updatedAt: '2026-06-15T00:00:00.000Z',
          revokedAt: null,
        },
        health: { summary: 'ok', checks: [] },
        syncSnapshot: { enabled: true, mode: 'local_snapshot', latest: null },
        capabilities: {
          envProvisioning: true,
          workflowSettings: true,
          syncSnapshots: true,
          ciRunTracking: true,
          deploymentHistory: true,
          driftDetection: true,
        },
      });
    }

    if (path === '/projects/project-1/workflow-settings') {
      return json(route, {
        enabled: true,
        source: 'project_options',
        settings: workflowSettings,
      });
    }

    if (path === '/projects/project-1/ci-runs') {
      return json(route, {
        enabled: true,
        mode: 'local_mock',
        liveGithubEnabled: false,
        githubActionsUrl: 'https://github.com/tone/orders-api/actions',
        runs: [],
      });
    }

    if (path === '/projects/project-1/deployments') {
      return json(route, {
        enabled: true,
        mode: 'local_mock',
        liveProvidersEnabled: false,
        deployments: [],
      });
    }

    if (path === '/projects/project-1/deployment-targets') {
      return json(route, [deploymentTarget]);
    }

    if (path === '/projects/project-1/env-vars') {
      return json(route, [
        {
          id: 'env-1',
          projectId: 'project-1',
          deploymentTargetId: 'target-1',
          environment: 'test',
          key: 'DATABASE_URL',
          provider: 'render',
          valueStored: false,
          lastProvisionedAt: '2026-06-15T00:00:00.000Z',
          lastProvisionedBy: 'user-1',
          status: 'provisioned',
          errorSummary: null,
        },
      ]);
    }

    if (path === '/projects/project-1/drift') {
      return json(route, {
        enabled: true,
        mode: 'local_snapshot',
        findings: [],
      });
    }

    if (path === '/projects/project-1/audit') {
      return json(route, {
        enabled: true,
        items: [
          {
            id: 'audit-1',
            eventCode: 'project_created',
            message: 'Project created',
            actorUserId: 'user-1',
            createdAt: '2026-06-15T00:00:00.000Z',
          },
        ],
      });
    }

    if (path === '/catalog/categories') {
      return json(route, { categories: [] });
    }

    if (path === '/catalog/templates') {
      return json(route, { templates: [] });
    }

    if (path === '/catalog/project-options') {
      return json(route, {
        repoShapes: [
          {
            id: 'single',
            label: 'Single repo',
            enabled: true,
            description: 'One service',
          },
        ],
        projectTypes: [
          {
            id: 'nestjs-api',
            label: 'NestJS API',
            kind: 'backend',
            language: 'TypeScript',
            framework: 'NestJS',
            repoShapes: ['single'],
            defaultRecipe: 'backend-api-ci',
            allowedRecipes: ['backend-api-ci'],
            defaultOptions: {
              lint: true,
              unit: true,
              build: true,
              coverage: true,
              security: true,
              docker: true,
            },
          },
        ],
        recipes: [
          {
            id: 'backend-api-ci',
            label: 'Backend API CI',
            description: 'Standard backend pipeline',
            supportedProjectTypes: ['nestjs-api'],
            templateByProjectType: { 'nestjs-api': 'be-nestjs' },
            mandatoryJobs: ['lint', 'unit', 'build'],
            supportedOptions: {
              lint: true,
              unit: true,
              build: true,
              coverage: true,
              security: true,
              docker: true,
            },
            optionJobs: {
              lint: 'lint',
              unit: 'test',
              build: 'build',
              security: 'security',
              docker: 'docker',
            },
          },
        ],
        nodeVersions: [{ value: '24', label: 'Node.js 24' }],
      });
    }

    if (path === '/workflows/history') {
      return json(route, { items: [] });
    }

    if (path === '/github/installations') {
      return json(route, { installations: [] });
    }

    if (path === '/github/app/install-url') {
      return json(route, {
        installUrl: 'https://github.com/apps/flowci-studio/installations/new',
        appSlug: 'flowci-studio',
      });
    }

    if (path === '/github/installations/accounts') {
      return json(route, { accounts: [] });
    }

    if (path === '/github/installations/repos') {
      return json(route, { repos: [] });
    }

    if (path === '/provider-connections') {
      return json(route, []);
    }

    return text(route, 404, `No E2E fixture for ${path}`);
  });
}

test('an admin walks the dashboard without a browser error', async ({
  page,
}) => {
  test.fixme(true, 'Predates project folders; moving into qa-journeys.ts');
  const consoleMessages: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleMessages.push(error.message);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await installDashboardAuditApi(page);
  await page.goto(`/workflows`, { waitUntil: 'networkidle' });
  // The heading is plain "Projects": the team comes from the header picker,
  // and the page has no dropdown of its own.
  await page
    .getByRole('heading', { level: 1, name: /^Projects/ })
    .waitFor({ state: 'visible' });
  await page
    .getByRole('button', { name: /^Active workspace:/ })
    .waitFor({ state: 'visible' });
  await page
    .getByRole('button', { name: 'Create project' })
    .waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expectVisibleText(page, 'Project created');

  await expectVisibleText(page, 'orders-api');
  // Pipeline runs and Workflow are one Pipeline tab: Runs | Configuration.
  for (const tab of [
    'Overview',
    'Pipeline',
    'Deployments',
    'Activity',
    'Audit',
    'Settings',
  ]) {
    await page.getByRole('tab', { name: tab }).waitFor({ state: 'visible' });
  }

  await page.getByRole('tab', { name: 'Pipeline', exact: true }).click();
  await page
    .getByRole('tablist', { name: 'Pipeline views' })
    .getByRole('tab', { name: 'Configuration' })
    .click();
  await expectVisibleText(page, 'Node version');
  await expectVisibleText(page, 'Lint');
  await expectVisibleText(page, 'Unit tests');
  await expectVisibleText(page, 'Build');
  await expectVisibleText(page, 'Security');
  await expectVisibleText(page, 'Deploy target mappings');

  await page
    .getByRole('tablist', { name: 'Pipeline views' })
    .getByRole('tab', { name: 'Runs' })
    .click();
  await expectVisibleText(page, 'Live GitHub run sync is not enabled');
  await page.getByRole('tab', { name: 'Deployments' }).click();
  await expectVisibleText(page, 'Live deployment sync is not enabled');
  // Environment merged into Hosting: its variables are the Hosting tab's Variables card.
  await page.getByRole('tab', { name: 'Hosting' }).click();
  await expectVisibleText(page, 'Deployment target');
  await expectVisibleText(page, 'Env key quota');
  await expectVisibleText(page, 'Managed Render services');
  await page.getByRole('tab', { name: 'Audit' }).click();
  await expectVisibleText(page, 'project_created');

  await page.goto(`/settings`, { waitUntil: 'networkidle' });
  await expectVisibleText(page, 'Workspace');
  await expectVisibleText(page, 'tone@example.test');
  await expectVisibleText(page, 'Email delivery unavailable');
  await page.getByRole('button', { name: 'Billing' }).click();
  await expectVisibleText(page, 'Usage');
  await expectVisibleText(page, 'deployment targets');

  if (consoleMessages.length > 0 || failedResponses.length > 0) {
    const details = [
      failedResponses.length
        ? `Failed responses:\n${failedResponses.join('\n')}`
        : '',
      consoleMessages.length
        ? `Console/page errors:\n${consoleMessages.join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    throw new Error(`Dashboard audit saw browser errors:\n${details}`);
  }
});
