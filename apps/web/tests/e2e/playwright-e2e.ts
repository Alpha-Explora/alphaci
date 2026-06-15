import { spawn } from 'node:child_process';
import process from 'node:process';
import type { Page, Route } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const LOCAL_PAGE_MARKERS = [
  'Ship with calm, not chaos.',
  'FlowCI Studio',
  'Pro subscription is 300 pesos per month',
];

function hasExpectedLandingMarker(text: string): boolean {
  return LOCAL_PAGE_MARKERS.some((marker) => text.includes(marker));
}

function isProtectedPreview(status: number | undefined, text: string): boolean {
  if (status === 401 || status === 403) {
    return true;
  }

  const normalized = text.toLowerCase();
  return (
    normalized.includes('authentication required') ||
    normalized.includes('access denied') ||
    normalized.includes('vercel authentication') ||
    normalized.includes('password required')
  );
}

function resolveBrowser(name: string): BrowserName {
  if (name === 'firefox' || name === 'webkit') {
    return name;
  }

  return 'chromium';
}

function launchBrowser(name: BrowserName) {
  const executablePath = process.env.E2E_BROWSER_EXECUTABLE_PATH;
  if (executablePath) {
    if (name !== 'chromium') {
      throw new Error('E2E_BROWSER_EXECUTABLE_PATH is only supported with chromium-compatible browsers');
    }
    return chromium.launch({ headless: true, executablePath });
  }

  switch (name) {
    case 'firefox':
      return firefox.launch({ headless: true });
    case 'webkit':
      return webkit.launch({ headless: true });
    default:
      return chromium.launch({ headless: true });
  }
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function text(route: Route, status: number, body: string) {
  return route.fulfill({
    status,
    contentType: 'text/plain',
    body,
  });
}

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
  workflowPath: '.github/workflows/00-flowci-access.yml',
  workflowFiles: [
    {
      stage: 'access',
      name: 'FlowCI Access Gate',
      path: '.github/workflows/00-flowci-access.yml',
      gated: true,
    },
    {
      stage: 'quality',
      name: 'FlowCI Quality',
      path: '.github/workflows/10-flowci-quality.yml',
      gated: true,
    },
    {
      stage: 'package',
      name: 'FlowCI Package',
      path: '.github/workflows/20-flowci-package.yml',
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
      });
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
            name: 'Personal workspace',
            kind: 'personal',
            role: 'owner',
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
          role: 'owner',
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
            body: 'tone/orders-api is now tracked by FlowCI.',
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
          { code: 'deployment_targets', current: 1, limit: 100, upgradeRequired: false },
          { code: 'managed_render_services', current: 1, limit: 10, upgradeRequired: false },
          { code: 'managed_vercel_projects', current: 0, limit: 10, upgradeRequired: false },
          { code: 'env_keys', current: 2, limit: 500, upgradeRequired: false },
          { code: 'workflow_prs', current: 0, limit: 100, upgradeRequired: false },
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
          tokenPrefix: 'fci_test',
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
      return json(route, { enabled: true, mode: 'local_snapshot', findings: [] });
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
      return json(route, { installUrl: 'https://github.com/apps/flowci-studio/installations/new' });
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

async function expectVisibleText(page: Page, textValue: string) {
  try {
    await page.getByText(textValue, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 15_000,
    });
  } catch (error) {
    const visibleText = await page.locator('body').evaluate((element) =>
      element instanceof HTMLElement ? element.innerText.slice(0, 2000) : '',
    );
    throw new Error(
      `Expected visible text not found: ${textValue}\nVisible text snapshot:\n${visibleText}`,
      { cause: error },
    );
  }
}

async function runDashboardAudit(page: Page, baseUrl: string) {
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
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'networkidle' });
  await expectVisibleText(page, 'Create & Manage Projects');
  await expectVisibleText(page, 'Personal workspace');
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expectVisibleText(page, 'Project created');

  await page.getByRole('tab', { name: 'Current Projects' }).click();
  await expectVisibleText(page, 'orders-api');
  for (const tab of [
    'Overview',
    'Workflow',
    'Runs',
    'Deployments',
    'Environment',
    'Activity',
    'Audit',
    'Settings',
  ]) {
    await page.getByRole('tab', { name: tab }).waitFor({ state: 'visible' });
  }

  await page.getByRole('tab', { name: 'Workflow' }).click();
  await expectVisibleText(page, 'Workflow recipe');
  await expectVisibleText(page, 'Package manager');
  await expectVisibleText(page, 'Lint');
  await expectVisibleText(page, 'Unit tests');
  await expectVisibleText(page, 'Build');
  await expectVisibleText(page, 'Security');
  await expectVisibleText(page, 'Deploy target mappings');

  await page.getByRole('tab', { name: 'Runs' }).click();
  await expectVisibleText(page, 'Live GitHub run sync is not enabled');
  await page.getByRole('tab', { name: 'Deployments' }).click();
  await expectVisibleText(page, 'Live deployment sync is not enabled');
  await page.getByRole('tab', { name: 'Environment' }).click();
  await expectVisibleText(page, 'Deployment target');
  await expectVisibleText(page, 'Env key quota');
  await expectVisibleText(page, 'Managed Render services');
  await page.getByRole('tab', { name: 'Audit' }).click();
  await expectVisibleText(page, 'project_created');

  await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
  await expectVisibleText(page, 'Workspace');
  await expectVisibleText(page, 'tone@example.test');
  await expectVisibleText(page, 'Email delivery unavailable');
  await page.getByRole('button', { name: 'Billing' }).click();
  await expectVisibleText(page, 'Usage');
  await expectVisibleText(page, 'deployment targets');

  if (consoleMessages.length > 0 || failedResponses.length > 0) {
    const details = [
      failedResponses.length ? `Failed responses:\n${failedResponses.join('\n')}` : '',
      consoleMessages.length ? `Console/page errors:\n${consoleMessages.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    throw new Error(`Dashboard audit saw browser errors:\n${details}`);
  }
}

async function waitForServer(url: string, timeoutMs = 45_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      // For deployment URLs, a protected preview can legitimately return 401/403.
      if (res.status >= 200 && res.status < 500) {
        return;
      }
    } catch {
      // server is not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for server at ${url}`);
}

async function isServerReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  const port = process.env.PORT || '4173';
  const baseUrl = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
  const browserName = resolveBrowser(process.env.E2E_BROWSER || 'chromium');
  const dashboardAudit = process.env.E2E_DASHBOARD_AUDIT === '1';
  const isExternalTarget = Boolean(process.env.E2E_BASE_URL);
  const waitTimeoutMs = isExternalTarget ? 120_000 : 45_000;

  const hasReusableLocalServer = isExternalTarget ? false : await isServerReachable(baseUrl);

  const app = isExternalTarget || hasReusableLocalServer
    ? null
    : spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', port], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
      });

  try {
    await waitForServer(baseUrl, waitTimeoutMs);

    const browser = await launchBrowser(browserName);
    try {
      const page = await browser.newPage();
      if (dashboardAudit) {
        await runDashboardAudit(page, baseUrl);
        console.log(`Playwright dashboard audit passed on ${browserName}`);
        return;
      }

      const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const status = response?.status();
      const text = (await page.textContent('body')) || '';

      if (isExternalTarget && isProtectedPreview(status, text)) {
        console.log(`Playwright smoke reached protected preview on ${browserName} (status: ${status ?? 'unknown'})`);
        return;
      }

      if (!hasExpectedLandingMarker(text)) {
        throw new Error(`Expected landing page content was not found (status: ${status ?? 'unknown'})`);
      }
    } finally {
      await browser.close();
    }

    console.log(`Playwright smoke test passed on ${browserName}`);
  } finally {
    app?.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
