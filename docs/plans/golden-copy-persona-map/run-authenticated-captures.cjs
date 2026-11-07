'use strict';

// Start the worktree's local API and web app with a scrubbed environment,
// capture all three editions against the disposable PostgreSQL fixture, then
// stop every process this runner started.
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '../../..');
const apiRoot = path.join(root, 'apps', 'api');
const webRoot = path.join(root, 'apps', 'web');
const apiEntry = path.join(apiRoot, 'dist', 'src', 'main.js');
const captureScript = path.join(__dirname, 'capture-pack-screens.cjs');
const nextBin = require.resolve('next/dist/bin/next', { paths: [webRoot] });
const databaseUrl = process.env.DATABASE_URL ||
  'postgresql://alphaci_migration_test:alphaci_migration_test_only@127.0.0.1:55432/alphaci_migration_test';
const apiPort = 4310;
const webPort = 3310;
const webOrigin = `http://127.0.0.1:${webPort}`;
const baseEnvKeys = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'HOME', 'USERPROFILE',
  'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'TZ',
]);
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => baseEnvKeys.has(key.toUpperCase())),
);
const apiChildren = new Set();
const webChildren = new Set();
let templateFixtureRoot;

function createTemplateCatalogFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alphaci-capture-catalog-'));
  const workflowRoot = path.join(fixtureRoot, 'workflow-templates', 'customer');
  const catalogRoot = path.join(fixtureRoot, 'catalog');
  fs.mkdirSync(workflowRoot, { recursive: true });
  fs.mkdirSync(catalogRoot, { recursive: true });

  const templateRecords = [
    ['nextjs-service-pipeline', 'Next.js service pipeline', ['frontend', 'javascript', 'typescript', 'next.js'], ['package.json', 'next.config.*']],
    ['react-service-pipeline', 'React service pipeline', ['frontend', 'javascript', 'typescript', 'react'], ['package.json', 'src/**']],
    ['nest-service-pipeline', 'NestJS service pipeline', ['backend', 'javascript', 'typescript', 'nestjs'], ['package.json', 'src/**']],
    ['nodejs-service-pipeline', 'Node.js service pipeline', ['backend', 'javascript', 'typescript', 'node.js'], ['package.json', 'src/**']],
  ];
  for (const [id, name, categories, filePatterns] of templateRecords) {
    fs.writeFileSync(path.join(workflowRoot, `${id}.properties.json`), JSON.stringify({
      name,
      description: `Local screenshot fixture for ${name}.`,
      iconName: 'octicon package',
      categories,
      filePatterns,
    }, null, 2));
    fs.writeFileSync(path.join(workflowRoot, `${id}.yml`), [
      `name: ${name}`,
      'on:',
      '  push:',
      '    branches: [main]',
      'jobs:',
      '  validate:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - run: npm ci && npm run build',
      '',
    ].join('\n'));
  }

  const stacks = [
    { key: 'nextjs', label: 'Next.js', kind: 'frontend', runtime: 'node', language: 'TypeScript', serviceWorkflow: 'nextjsService', serviceTemplate: 'nextjs-service-pipeline', repoShapes: ['standalone', 'multi'] },
    { key: 'react', label: 'React', kind: 'frontend', runtime: 'node', language: 'TypeScript', serviceWorkflow: 'reactService', serviceTemplate: 'react-service-pipeline', repoShapes: ['standalone', 'multi'] },
    { key: 'nestjs', label: 'NestJS', kind: 'backend', runtime: 'node', language: 'TypeScript', serviceWorkflow: 'nestService', serviceTemplate: 'nest-service-pipeline', repoShapes: ['standalone', 'multi'] },
    { key: 'nodejs', label: 'Node.js', kind: 'backend', runtime: 'node', language: 'TypeScript', serviceWorkflow: 'nodeService', serviceTemplate: 'nodejs-service-pipeline', repoShapes: ['standalone', 'multi'] },
  ];
  const workflowRefs = {
    repository: 'AlphaCI/alphaci-central-workflows',
    currentStable: 'fixture-v1',
    workflows: {
      nextjsService: 'workflows/nextjs.yml',
      reactService: 'workflows/react.yml',
      nestService: 'workflows/nestjs.yml',
      nodeService: 'workflows/nodejs.yml',
    },
    nodeVersions: [{ value: '22', label: 'Node.js 22' }],
  };
  fs.writeFileSync(path.join(catalogRoot, 'stacks.json'), JSON.stringify(stacks, null, 2));
  fs.writeFileSync(path.join(catalogRoot, 'actions.json'), '[]');
  fs.writeFileSync(path.join(catalogRoot, 'providers.json'), '[]');
  fs.writeFileSync(path.join(catalogRoot, 'plans.json'), '[]');
  fs.writeFileSync(path.join(catalogRoot, 'workflow-refs.json'), JSON.stringify(workflowRefs, null, 2));
  return fixtureRoot;
}

function removeTemplateCatalogFixture() {
  if (!templateFixtureRoot) return;
  const tempRoot = path.resolve(os.tmpdir());
  const target = path.resolve(templateFixtureRoot);
  if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith('alphaci-capture-catalog-')) {
    throw new Error(`Refusing to remove unexpected catalog fixture path: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  templateFixtureRoot = undefined;
}

function applianceSettings() {
  const file = path.join(root, 'deploy', 'selfhost', 'alphaci.env.example');
  const composition = new Set([
    'ALPHACI_DEPLOYMENT_MODE', 'ALPHACI_EDITION', 'ALPHACI_BUILD_PROFILE',
    'STORAGE_DRIVER', 'SESSION_STORE_DRIVER',
  ]);
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && (composition.has(match[1]) || match[1].endsWith('_ENABLED'))) {
      values[match[1]] = match[2].trim();
    }
  }
  return values;
}

function editionEnv(edition) {
  const profile = edition === 'enterprise' ? 'enterprise' : 'hosted';
  return {
    ...baseEnv,
    ...applianceSettings(),
    ALPHACI_IGNORE_ENV_FILE: 'true',
    NODE_ENV: 'development',
    DEV_QUICK_LOGIN: 'true',
    ALPHACI_DEPLOYMENT_MODE: 'saas',
    ALPHACI_BUILD_PROFILE: profile,
    ALPHACI_EDITION: edition,
    PORT: String(apiPort),
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: randomBytes(32).toString('hex'),
    ENV_PROVISIONING_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    SESSION_SECURE: 'false',
    SESSION_COOKIE_SAMESITE: 'lax',
    SESSION_STORE_DRIVER: 'postgres',
    STORAGE_DRIVER: 'postgres',
    FRONTEND_URL: webOrigin,
    ALLOWED_ORIGINS: webOrigin,
    PLATFORM_PUBLIC_URL: `http://127.0.0.1:${apiPort}`,
    GITHUB_CLIENT_ID: 'fullstack-capture',
    GITHUB_CLIENT_SECRET: 'fullstack-capture',
    ENABLE_SWAGGER: 'false',
    CI_RUN_LIVE_GITHUB_ENABLED: 'false',
    DEPLOYMENT_HISTORY_LIVE_PROVIDERS_ENABLED: 'false',
    MEMBER_DIRECTORY_SOURCE: 'accounts',
    TEMPLATE_REPO_PATH: templateFixtureRoot,
    TEMPLATE_WORKFLOW_DIR: 'workflow-templates/customer',
  };
}

function webEnv(edition) {
  const profile = edition === 'enterprise' ? 'enterprise' : 'hosted';
  return {
    ...baseEnv,
    NODE_ENV: 'development',
    NEXT_PUBLIC_API_BASE_URL: '/api/v1',
    API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    ALPHACI_BUILD_PROFILE: profile,
    ALPHACI_EDITION: edition,
    NEXT_PUBLIC_USE_MOCK: 'false',
    NEXT_PUBLIC_DEV_QUICK_LOGIN: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

function start(name, command, args, cwd, env, collection) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  collection.add(child);
  console.log(`[${name}] started pid ${child.pid ?? '(pending)'}`);
  child.stdout.on('data', (chunk) => {
    if (!name.startsWith('api-')) {
      process.stdout.write(`[${name}] ${chunk}`);
      return;
    }
    const useful = String(chunk).split(/\r?\n/).filter((line) =>
      /Application running|successfully started|Postgres target:|Unhandled exception|ERROR|WARN/.test(line),
    );
    if (useful.length) process.stdout.write(`[${name}] ${useful.join('\n')}` + (String(chunk).endsWith('\n') ? '\n' : ''));
  });
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.once('exit', () => collection.delete(child));
  child.once('error', (error) => console.error(`[${name}] ${error.message}`));
  return child;
}

async function waitFor(url, child, name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  let lastError = 'no request attempted';
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${name} exited with code ${child.exitCode}, signal ${child.signalCode}; last probe: ${lastStatus ?? lastError}.`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      lastStatus = response.status;
      if (response.ok) {
        console.log(`[${name}] ready with HTTP ${response.status}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(300);
  }
  throw new Error(`${name} did not answer ${url} within ${timeoutMs / 1000} seconds; last probe: ${lastStatus ?? lastError}; pid=${child.pid ?? 'unknown'}, exitCode=${child.exitCode}, signal=${child.signalCode}.`);
}

async function stop(child) {
  if (child.exitCode !== null || child.killed || child.pid === undefined) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await Promise.race([exited, delay(5_000)]);
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5_000),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function capture(edition) {
  console.log(`\n=== ${edition.toUpperCase()} authenticated captures ===`);
  const api = start(
    `api-${edition}`, process.execPath, [apiEntry], apiRoot, editionEnv(edition), apiChildren,
  );
  await waitFor(`http://127.0.0.1:${apiPort}/api/v1/auth/config-check`, api, `API (${edition})`, 180_000);

  const web = start(
    `web-${edition}`, process.execPath,
    [nextBin, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(webPort)],
    webRoot, webEnv(edition), webChildren,
  );
  await waitFor(`${webOrigin}/login`, web, `Web app (${edition})`);

  const result = spawnSync(process.execPath, [captureScript, edition], {
    cwd: root,
    env: {
      ...baseEnv,
      NODE_ENV: 'development',
      ALPHACI_SCREENSHOT_ORIGIN: webOrigin,
      ALPHACI_SCREENSHOT_AUTHENTICATED: 'true',
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`The ${edition} capture exited with code ${result.status}.`);

  await stop(web);
  await stop(api);
}

async function main() {
  const url = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname.replace(/^\[|\]$/g, '').toLowerCase()) ||
      url.port !== '55432' || url.pathname !== '/alphaci_migration_test') {
    throw new Error('Only the loopback PostgreSQL screenshot fixture on port 55432 is allowed.');
  }
  if (!fs.existsSync(apiEntry)) throw new Error('Build the API before running authenticated captures.');
  for (const port of [apiPort, webPort]) {
    const server = require('node:net').createServer();
    await new Promise((resolve, reject) => {
      server.once('error', () => reject(new Error(`Port ${port} is already in use.`)));
      server.listen(port, '127.0.0.1', () => server.close(resolve));
    });
  }
  const editions = process.argv.slice(2);
  const selectedEditions = editions.length ? editions : ['saas', 'edu', 'enterprise'];
  if (!selectedEditions.every((edition) => ['saas', 'edu', 'enterprise'].includes(edition))) {
    throw new Error('Usage: node run-authenticated-captures.cjs [saas|edu|enterprise ...]');
  }
  templateFixtureRoot = createTemplateCatalogFixture();
  try {
    for (const edition of selectedEditions) {
      try {
        await capture(edition);
      } finally {
        await Promise.all([...webChildren, ...apiChildren].map(stop));
      }
    }
  } finally {
    removeTemplateCatalogFixture();
  }
}

main().catch(async (error) => {
  console.error(error);
  await Promise.all([...webChildren, ...apiChildren].map(stop));
  try { removeTemplateCatalogFixture(); } catch (cleanupError) { console.error(cleanupError); }
  process.exitCode = 1;
});
