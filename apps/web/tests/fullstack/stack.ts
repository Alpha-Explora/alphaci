import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

/* The pieces of the stack the full-stack runner (run.ts) starts and stops:
 * the API's disposable Postgres fixture, both builds, the compiled API and
 * `next start`, each with the configuration the run needs. */

export const WEB_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');
const API_ROOT = join(REPO_ROOT, 'apps', 'api');
const NEXT_BIN = require.resolve('next/dist/bin/next', { paths: [WEB_ROOT] });

// The API end-to-end suite's fixture: postgres:16-alpine on tmpfs, published
// on loopback only, test-only credentials, the self-hosted role bootstrap.
// Its own compose project keeps it apart from a running API e2e fixture.
const COMPOSE_FILE = join(API_ROOT, 'tests', 'integration', 'database', 'compose.yaml');
const COMPOSE_PROJECT = 'alphaci-fullstack';
const DATABASE_PORT = 55432;
const DATABASE_URL = `postgresql://alphaci_migration_test:alphaci_migration_test_only@127.0.0.1:${DATABASE_PORT}/alphaci_migration_test`;

export interface StackPorts {
  readonly api: number;
  readonly web: number;
}

export function stackPorts(env: NodeJS.ProcessEnv = process.env): StackPorts {
  return {
    api: Number(env.FULLSTACK_API_PORT ?? 4310),
    web: Number(env.FULLSTACK_WEB_PORT ?? 3310),
  };
}

export function loopbackOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

export interface Service {
  readonly name: string;
  readonly child: ChildProcess;
  readonly logFile: string;
}

interface SpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  /** Run `command` through the shell; needed for npm on Windows. */
  readonly shell?: boolean;
}

/**
 * Every process the run spawns, so one call stops them all: the services, and
 * a build still running when another step has already failed.
 */
export class ProcessGroup {
  private readonly running = new Set<Service>();
  private closed = false;

  constructor(private readonly logDir: string) {}

  /** Start a long-running process; its output goes to <logDir>/<name>.log. */
  start(name: string, command: string, args: readonly string[], options: SpawnOptions): Service {
    if (this.closed) throw new Error(`Not starting ${name}: the stack is shutting down.`);
    const logFile = join(this.logDir, `${name}.log`);
    const log = openSync(logFile, 'a');
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell ?? false,
      stdio: ['ignore', log, log],
      // Its own process group on POSIX, so stop() reaches its children too.
      detached: process.platform !== 'win32',
    });
    closeSync(log);
    const service = { name, child, logFile };
    this.running.add(service);
    child.once('exit', () => this.running.delete(service));
    return service;
  }

  /** Run a command to completion. A non-zero exit throws with the log tail. */
  async run(name: string, command: string, args: readonly string[], options: SpawnOptions): Promise<void> {
    const service = this.start(name, command, args, options);
    const code = await new Promise<number | null>((done) => {
      service.child.once('error', () => done(null));
      service.child.once('exit', (exitCode) => done(exitCode));
    });
    if (code !== 0) {
      throw new Error(`${name} failed (exit ${String(code)}).\n${logTail(service.logFile)}`);
    }
  }

  async stopAll(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.running].map(stop));
  }
}

async function stop(service: Service): Promise<void> {
  const { child } = service;
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  const exited = new Promise<void>((done) => child.once('exit', () => done()));
  const exitedWithin = (ms: number) =>
    Promise.race([exited.then(() => true), delay(ms).then(() => false)]);
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await exitedWithin(10_000);
    return;
  }
  signalGroup(child.pid, 'SIGTERM');
  if (await exitedWithin(10_000)) return;
  signalGroup(child.pid, 'SIGKILL');
  await exitedWithin(5_000);
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is already gone.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms).unref());
}

export function logTail(file: string, lines = 40): string {
  if (!existsSync(file)) return '';
  const tail = readFileSync(file, 'utf8').trimEnd().split(/\r?\n/).slice(-lines);
  return `--- last ${tail.length} lines of ${file} ---\n${tail.join('\n')}`;
}

/** Poll until `url` answers 2xx. Fails early, with its log, if the service exits. */
export async function waitForHttp(url: string, service: Service, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (service.child.exitCode !== null) {
      throw new Error(
        `${service.name} exited (code ${service.child.exitCode}) before ${url} answered.\n${logTail(service.logFile)}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await delay(500);
  }
  throw new Error(`${service.name} did not answer ${url} within ${timeoutMs / 1000} s.\n${logTail(service.logFile)}`);
}

export function assertPortFree(port: number, hint: string): Promise<void> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', () => fail(new Error(`Port ${port} is already in use. ${hint}`)));
    server.listen(port, '127.0.0.1', () => server.close(() => done()));
  });
}

/**
 * The only variables the API and `next start` inherit: what a process needs
 * to run at all. Everything else is set explicitly, so a developer's shell
 * (GitHub App keys, SUPABASE_*, provider tokens) never reaches the stack.
 */
function baseEnv(): NodeJS.ProcessEnv {
  const keep = new Set([
    'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'HOME', 'USERPROFILE',
    'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'TZ',
  ]);
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => keep.has(key.toUpperCase())),
  );
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function compose(group: ProcessGroup, args: readonly string[]): Promise<void> {
  return group.run('database', 'docker', ['compose', '-f', COMPOSE_FILE, '-p', COMPOSE_PROJECT, ...args], {
    cwd: WEB_ROOT,
    env: process.env,
  });
}

export async function startDatabase(group: ProcessGroup): Promise<void> {
  // A run that was killed may have left its container behind; start clean.
  await compose(group, ['down', '-v', '--remove-orphans']);
  await assertPortFree(
    DATABASE_PORT,
    'The API e2e fixture may be running: docker compose -p alphaci-e2e down -v',
  );
  await compose(group, ['up', '-d', '--wait']);
}

/** Runs outside the process group, which is closed by the time cleanup runs. */
export function stopDatabase(logDir: string): Promise<void> {
  return new ProcessGroup(logDir).run(
    'database',
    'docker',
    ['compose', '-f', COMPOSE_FILE, '-p', COMPOSE_PROJECT, 'down', '-v', '--remove-orphans'],
    { cwd: WEB_ROOT, env: process.env },
  );
}

/** The self-hosted migration runner the appliance's `migrate` service runs. */
export function migrateDatabase(group: ProcessGroup): Promise<void> {
  return group.run('migrate', process.execPath, ['dist/src/scripts/migrate-selfhost.js'], {
    cwd: API_ROOT,
    env: { ...baseEnv(), DATABASE_URL },
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function buildApi(group: ProcessGroup): Promise<void> {
  return group.run('api-build', 'npm run build -w @alphaci/api', [], {
    cwd: REPO_ROOT,
    env: process.env,
    shell: true,
  });
}

// The appliance's shipped settings, so the run exercises its real defaults.
const APPLIANCE_ENV_FILE = join(REPO_ROOT, 'deploy', 'selfhost', 'alphaci.env.example');
const APPLIANCE_COMPOSITION_KEYS = [
  'ALPHACI_DEPLOYMENT_MODE',
  'ALPHACI_EDITION',
  'ALPHACI_BUILD_PROFILE',
  'STORAGE_DRIVER',
  'SESSION_STORE_DRIVER',
];

/**
 * The composition settings and every `*_ENABLED` feature flag the appliance
 * ships in alphaci.env.example (KEY=value lines, comments skipped). A feature
 * the appliance leaves off stays off here too.
 */
function applianceSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const line of readFileSync(APPLIANCE_ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && (APPLIANCE_COMPOSITION_KEYS.includes(match[1]) || match[1].endsWith('_ENABLED'))) {
      settings[match[1]] = match[2].trim();
    }
  }
  const missing = APPLIANCE_COMPOSITION_KEYS.filter((key) => !settings[key]);
  if (missing.length > 0) {
    throw new Error(`${APPLIANCE_ENV_FILE} no longer sets ${missing.join(', ')}.`);
  }
  return settings;
}

function apiEnv(ports: StackPorts, egressEnv: Readonly<Record<string, string>>, logDir: string): NodeJS.ProcessEnv {
  const web = loopbackOrigin(ports.web);
  return {
    ...baseEnv(),
    ...egressEnv,
    // apps/api/.env is a developer's; this run reads nothing from it.
    ALPHACI_IGNORE_ENV_FILE: 'true',
    // Quick login exists only in development, and only from loopback.
    NODE_ENV: 'development',
    DEV_QUICK_LOGIN: 'true',
    PORT: String(ports.api),
    // The Supabase-free appliance settings and feature flags, read from
    // deploy/selfhost/alphaci.env.example (SUBSCRIPTION_GATE_ENABLED=false,
    // WORKSPACES_ENABLED=true, NOTIFICATIONS_ENABLED=true among them).
    ...applianceSettings(),
    DATABASE_URL,
    ENABLE_SWAGGER: 'false',
    // Throwaway secrets, new every run.
    SESSION_SECRET: randomBytes(32).toString('hex'),
    ENV_PROVISIONING_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    // Plain HTTP on one loopback origin: the web server proxies /api/v1 here.
    SESSION_SECURE: 'false',
    SESSION_COOKIE_SAMESITE: 'lax',
    FRONTEND_URL: web,
    ALLOWED_ORIGINS: web,
    PLATFORM_PUBLIC_URL: loopbackOrigin(ports.api),
    // Required at boot. OAuth never runs; quick login replaces it.
    GITHUB_CLIENT_ID: 'fullstack-e2e',
    GITHUB_CLIENT_SECRET: 'fullstack-e2e',
    // Provider reads that default to on. Off, pages show stored data only.
    CI_RUN_LIVE_GITHUB_ENABLED: 'false',
    DEPLOYMENT_HISTORY_LIVE_PROVIDERS_ENABLED: 'false',
    // Members come from AlphaCI accounts, not the GitHub organization.
    MEMBER_DIRECTORY_SOURCE: 'accounts',
    // No central workflow checkout, locally or in CI, so both load the same
    // built-in catalog. The path is never created.
    TEMPLATE_REPO_PATH: join(logDir, 'no-workflow-templates'),
  };
}

export function startApi(
  group: ProcessGroup,
  ports: StackPorts,
  egressEnv: Readonly<Record<string, string>>,
  logDir: string,
): Service {
  return group.start('api', process.execPath, ['dist/src/main.js'], {
    cwd: API_ROOT,
    env: apiEnv(ports, egressEnv, logDir),
  });
}

// ---------------------------------------------------------------------------
// Web
// ---------------------------------------------------------------------------

/** Read by next.config.ts at build time and again by `next start`. */
function webAppEnv(ports: StackPorts): NodeJS.ProcessEnv {
  return {
    // Same origin, as the self-hosted image serves it behind Caddy: the browser
    // calls /api/v1 on the web origin and Next proxies it to the API, so the
    // session cookie is first-party.
    NEXT_PUBLIC_API_BASE_URL: '/api/v1',
    API_PROXY_TARGET: loopbackOrigin(ports.api),
    ALPHACI_BUILD_PROFILE: 'enterprise',
    ALPHACI_EDITION: 'enterprise',
    // Pinned like the Dockerfile, so apps/web/.env.local cannot change them.
    // The quick-login button stays hidden in any production build anyway: it
    // also needs NODE_ENV=development (see features/auth/login/model).
    NEXT_PUBLIC_USE_MOCK: 'false',
    NEXT_PUBLIC_DEV_QUICK_LOGIN: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

export function buildWeb(group: ProcessGroup, ports: StackPorts): Promise<void> {
  // Inherits the shell: next/font downloads the Google fonts at build time.
  return group.run('web-build', process.execPath, [NEXT_BIN, 'build', '--webpack'], {
    cwd: WEB_ROOT,
    env: { ...process.env, ...webAppEnv(ports) },
  });
}

/** For --skip-build: the existing .next must proxy /api/v1 to this run's API. */
export function assertWebBuildTargets(ports: StackPorts): void {
  const manifest = join(WEB_ROOT, '.next', 'routes-manifest.json');
  const destination = `${loopbackOrigin(ports.api)}/api/v1/`;
  const content = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
  if (!content.includes(destination)) {
    throw new Error(
      `--skip-build needs a web build made by this runner for API port ${ports.api}, ` +
        `but ${manifest} does not proxy /api/v1 to ${destination}. Run without --skip-build.`,
    );
  }
}

export function startWeb(
  group: ProcessGroup,
  ports: StackPorts,
  egressEnv: Readonly<Record<string, string>>,
): Service {
  return group.start('web', process.execPath, [NEXT_BIN, 'start', '-H', '127.0.0.1', '-p', String(ports.web)], {
    cwd: WEB_ROOT,
    env: { ...baseEnv(), ...egressEnv, ...webAppEnv(ports) },
  });
}
