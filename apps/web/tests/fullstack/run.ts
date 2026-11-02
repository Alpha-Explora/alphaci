import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { chromium, type Page } from 'playwright';

import { startEgressGuard, type EgressGuard } from './egress-guard';
import { journeys, type ExpectedResponse, type Journey } from './journeys';
import {
  ProcessGroup,
  WEB_ROOT,
  assertPortFree,
  assertWebBuildTargets,
  buildApi,
  buildWeb,
  logTail,
  loopbackOrigin,
  migrateDatabase,
  startApi,
  startDatabase,
  startWeb,
  stackPorts,
  stopDatabase,
  waitForHttp,
} from './stack';

/*
 * Full-stack journeys: the web app against the real API, not fixtures.
 *
 *   npm run test:fullstack -w @alphaci/web [-- --skip-build]
 *
 * Starts the API e2e suite's disposable Postgres, applies the migrations with
 * the self-hosted runner, starts the compiled API in self-hosted mode with
 * quick login on, builds and starts the web app (same origin, /api/v1 proxied
 * to the API), and drives the journeys in journeys.ts with Playwright
 * chromium. Any page error, console error, failed or 4xx/5xx same-origin
 * request, or attempt by the browser, API or web server to reach a
 * non-loopback host fails the run. Everything is stopped at the end.
 *
 * Writes test-results/fullstack/: report.json, one log per process, and a
 * screenshot of each failed journey. Overwrites apps/web/.next.
 * --skip-build reuses apps/api/dist and a .next this runner built.
 */

const REPORT_DIR = join(WEB_ROOT, 'test-results', 'fullstack');
// The API usually answers within 6 s. Loading a freshly compiled dist/ while
// `next build` saturates the machine has taken close to 60 s on Windows.
const SERVICE_READY_MS = 120_000;

interface JourneyResult {
  name: string;
  result: 'passed' | 'failed' | 'skipped';
  problems: string[];
  screenshot?: string;
}

interface Report {
  result: 'passed' | 'failed';
  commit: string;
  startedAt: string;
  seconds: number;
  steps: { name: string; seconds: number; ok: boolean }[];
  journeys: JourneyResult[];
  egressAttempts: string[];
  error?: string;
}

const startedAt = performance.now();
const report: Report = {
  result: 'failed',
  commit: currentCommit(),
  startedAt: new Date().toISOString(),
  seconds: 0,
  steps: [],
  journeys: [],
  egressAttempts: [],
};

function log(message: string): void {
  console.log(`[fullstack] ${message}`);
}

function elapsed(since: number): number {
  return Math.round((performance.now() - since) / 100) / 10;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function currentCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  const git = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: WEB_ROOT,
    encoding: 'utf8',
  });
  return git.status === 0 ? git.stdout.trim() : 'unknown';
}

async function step<T>(name: string, work: () => Promise<T> | T): Promise<T> {
  const started = performance.now();
  log(`${name} ...`);
  try {
    const value = await work();
    report.steps.push({ name, seconds: elapsed(started), ok: true });
    log(`${name}: ok (${elapsed(started)} s)`);
    return value;
  } catch (error) {
    report.steps.push({ name, seconds: elapsed(started), ok: false });
    log(`${name}: FAILED (${elapsed(started)} s)`);
    throw error;
  }
}

function isLoopback(url: URL): boolean {
  return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}

/**
 * Collect everything on the page that counts as a failure, except the 4xx/5xx
 * responses the current journey expects (and Chrome's console line for them).
 */
function watchPage(
  page: Page,
  baseUrl: string,
  problems: string[],
  expected: () => readonly ExpectedResponse[],
): void {
  const isExpected = (status: number, url: string, method?: string) =>
    expected().some(
      (response) =>
        response.status === status &&
        url === `${baseUrl}${response.path}` &&
        (method === undefined || response.method === method),
    );
  page.on('pageerror', (error) =>
    problems.push(`page error: ${error.message}`),
  );
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const resourceStatus = /^Failed to load resource: .* status of (\d+)/.exec(
      message.text(),
    );
    if (
      resourceStatus &&
      isExpected(Number(resourceStatus[1]), message.location().url)
    )
      return;
    problems.push(`console error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    // Navigating away cancels in-flight requests and prefetches; not a failure.
    if (request.url().startsWith(baseUrl) && failure !== 'net::ERR_ABORTED') {
      problems.push(
        `request failed: ${request.method()} ${request.url()} (${failure})`,
      );
    }
  });
  page.on('response', (response) => {
    const method = response.request().method();
    if (!response.url().startsWith(baseUrl) || response.status() < 400) return;
    if (isExpected(response.status(), response.url(), method)) return;
    problems.push(`HTTP ${response.status()}: ${method} ${response.url()}`);
  });
}

async function runJourneys(baseUrl: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route(
      (url) => !isLoopback(url),
      (route) => {
        report.egressAttempts.push(
          `browser: ${route.request().method()} ${route.request().url()}`,
        );
        return route.abort('blockedbyclient');
      },
    );
    const page = await context.newPage();
    const problems: string[] = [];
    let current: Journey | undefined;
    watchPage(page, baseUrl, problems, () => current?.expectedResponses ?? []);

    let failed = false;
    for (const [index, journey] of journeys.entries()) {
      if (failed) {
        report.journeys.push({
          name: journey.name,
          result: 'skipped',
          problems: [],
        });
        continue;
      }
      problems.length = 0;
      current = journey;
      log(`journey: ${journey.name}`);
      try {
        await journey.run(page, baseUrl);
        // Let late requests land so they are charged to this journey.
        await page
          .waitForLoadState('networkidle', { timeout: 5_000 })
          .catch(() => undefined);
      } catch (error) {
        problems.unshift(`assertion: ${errorMessage(error)}`);
      }
      const result: JourneyResult = {
        name: journey.name,
        result: 'passed',
        problems: [...problems],
      };
      if (problems.length > 0) {
        failed = true;
        result.result = 'failed';
        result.screenshot = `journey-${index + 1}.png`;
        await page
          .screenshot({
            path: join(REPORT_DIR, result.screenshot),
            fullPage: true,
          })
          .catch(() => undefined);
      }
      report.journeys.push(result);
      log(`journey: ${journey.name}: ${result.result}`);
      for (const problem of result.problems) log(`  ${problem}`);
    }
    if (failed) throw new Error('A journey failed.');
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const skipBuild = process.argv.includes('--skip-build');
  const ports = stackPorts();
  rmSync(REPORT_DIR, { recursive: true, force: true });
  mkdirSync(REPORT_DIR, { recursive: true });

  const group = new ProcessGroup(REPORT_DIR);
  const pending: Promise<unknown>[] = [];
  let egress: EgressGuard | undefined;
  let cleanup: Promise<void> | undefined;
  let serverEgressRecorded = false;
  const recordServerEgress = () => {
    if (serverEgressRecorded || !egress) return;
    serverEgressRecorded = true;
    report.egressAttempts.push(
      ...egress.attempts.map((attempt) => `server: ${attempt}`),
    );
  };
  const stopEverything = () =>
    (cleanup ??= (async () => {
      log('stopping the stack ...');
      await group.stopAll();
      await Promise.allSettled(pending);
      await stopDatabase(REPORT_DIR).catch((error: unknown) =>
        log(errorMessage(error)),
      );
      await egress?.close();
    })());

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      report.error = `Interrupted by ${signal}.`;
      void stopEverything().finally(() =>
        finish(signal === 'SIGINT' ? 130 : 143),
      );
    });
  }

  try {
    await step('check ports', async () => {
      await assertPortFree(ports.api, 'Set FULLSTACK_API_PORT to use another.');
      await assertPortFree(ports.web, 'Set FULLSTACK_WEB_PORT to use another.');
    });
    egress = await startEgressGuard();
    const egressEnv = egress.env;

    const apiReady = (async () => {
      await Promise.all([
        step('start Postgres', () => startDatabase(group)),
        skipBuild
          ? Promise.resolve()
          : step('build API', () => buildApi(group)),
      ]);
      await step('migrate database', () => migrateDatabase(group));
      const api = startApi(group, ports, egressEnv, REPORT_DIR);
      await step('start API', () =>
        waitForHttp(
          `${loopbackOrigin(ports.api)}/api/v1/health`,
          api,
          SERVICE_READY_MS,
        ),
      );
    })();
    const webBuilt = skipBuild
      ? step('check web build', () => assertWebBuildTargets(ports))
      : step('build web', () => buildWeb(group, ports));
    pending.push(apiReady, webBuilt);
    await Promise.all(pending);

    const baseUrl = loopbackOrigin(ports.web);
    const web = startWeb(group, ports, egressEnv);
    await step('start web', () =>
      waitForHttp(`${baseUrl}/healthz`, web, SERVICE_READY_MS),
    );
    await step('journeys', () => runJourneys(baseUrl));

    recordServerEgress();
    if (report.egressAttempts.length > 0) {
      throw new Error(
        `Requests tried to leave the runner:\n  ${report.egressAttempts.join('\n  ')}`,
      );
    }
    report.result = 'passed';
  } catch (error) {
    report.error ??= errorMessage(error);
    log(report.error);
    for (const name of ['api', 'web']) {
      const tail = logTail(join(REPORT_DIR, `${name}.log`), 20);
      if (tail) console.log(tail);
    }
  } finally {
    await stopEverything();
    recordServerEgress();
  }
  finish(report.result === 'passed' ? 0 : 1);
}

function finish(code: number): never {
  report.seconds = elapsed(startedAt);
  writeFileSync(
    join(REPORT_DIR, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  log(
    `${report.result.toUpperCase()} in ${report.seconds} s. Report: ${join(REPORT_DIR, 'report.json')}`,
  );
  process.exit(code);
}

void main();
