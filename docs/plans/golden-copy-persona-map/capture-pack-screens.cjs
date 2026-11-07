'use strict';

// Captures rendered App Router pages for one running edition build. The label
// overlay is added by Playwright and is not part of the AlphaCI application.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const frontend = require('./frontend-persona-map.cjs');

const pack = process.argv[2];
const origin = process.env.ALPHACI_SCREENSHOT_ORIGIN || 'http://localhost:3000';
const authenticated = process.env.ALPHACI_SCREENSHOT_AUTHENTICATED === 'true';
const output = path.resolve(__dirname, 'screenshots', ...(authenticated ? ['authenticated'] : []), pack || '');
let browser;
if (!['saas', 'edu', 'enterprise'].includes(pack)) {
  throw new Error('Usage: node capture-pack-screens.cjs saas|edu|enterprise');
}
const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../apps/api/src/kernel/composition/catalog.source.json'), 'utf8'));
const labels = { saas: 'SaaS', edu: 'EDU', enterprise: 'Enterprise' };
const routeIds = authenticated ? {
  projectId: '92000000-0000-4000-8000-000000000001',
  groupId: '91000000-0000-4000-8000-000000000001',
  systemId: '98000000-0000-4000-8000-000000000001',
  repositoryId: '98200000-0000-4000-8000-000000000001',
  deliveryProjectId: '98100000-0000-4000-8000-000000000001',
  runId: '97000000-0000-4000-8000-000000000001',
  deliveryProjectRunId: '97600000-0000-4000-8000-000000000001',
  id: '93000000-0000-4000-8000-000000000001',
} : {
  projectId: 'sample-project',
  groupId: 'sample-team',
  systemId: 'sample-system',
  repositoryId: 'sample-repository',
  deliveryProjectId: 'sample-project',
  runId: 'sample-run',
  deliveryProjectRunId: 'sample-run',
  id: 'sample-user',
};
const routes = frontend.frontend
  .filter(({ id }) => id.startsWith('page:'))
  .map((entry) => ({
    ...entry,
    path: entry.routes[0]
      .replace('[projectId]', routeIds.projectId)
      .replace('[groupId]', routeIds.groupId)
      .replace('[systemId]', routeIds.systemId)
      .replace('[repositoryId]', routeIds.repositoryId)
      .replace('[deliveryProjectId]', routeIds.deliveryProjectId)
      .replace('[runId]', entry.routes[0].startsWith('/qa/project-report/') ? routeIds.deliveryProjectRunId : routeIds.runId)
      .replace('[id]', routeIds.id),
  }));

function membership(entry) {
  if (entry.id === 'page:/') return ['saas'];
  const keys = [...entry.owners, ...(entry.relatedCapabilities ?? [])];
  const records = keys.map((key) => catalog.capabilities.find((c) => c.key === key)).filter(Boolean);
  if (records.length === 0) return ['saas', 'edu', 'enterprise'];
  return ['saas', 'edu', 'enterprise'].filter((edition) => records.every((r) => r.editions.includes(edition)));
}

async function waitForRenderedContent(page) {
  await page.waitForTimeout(authenticated ? 1400 : 1600);
  if (!authenticated) return;
  await page.waitForFunction(() => {
    const body = document.body;
    const text = body?.innerText?.trim() ?? '';
    const waiting = /preparing your workspace|loading your dashboard|loading your workspace|verifying session|finishing sign.in/i.test(text);
    const loader = document.querySelector('.pipeline-loader-shell');
    const content = document.querySelector('#main-content, main, form, [role="main"]');
    return Boolean(content) && text.length > 70 && !waiting && !loader;
  }, undefined, { timeout: 12_000 }).catch(() => undefined);
  await page.waitForTimeout(600);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultNavigationTimeout(60_000);
  let session = null;
  let seed = null;
  if (authenticated) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Authenticated captures require DATABASE_URL for the loopback screenshot fixture.');
    }
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    const login = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/dev/quick-login', {
        method: 'POST',
        credentials: 'include',
      });
      return { status: response.status, body: await response.text() };
    });
    if (login.status !== 201) {
      throw new Error(`Local quick login failed with HTTP ${login.status}: ${login.body.slice(0, 250)}`);
    }
    const initialSession = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/me', { credentials: 'include' });
      return response.ok ? response.json() : null;
    });
    if (!initialSession?.authenticated) {
      throw new Error('Quick login returned 201 but /auth/me did not establish an authenticated API session.');
    }
    seed = await require('./seed-authenticated-capture.cjs').seedAuthenticatedCapture(process.env.DATABASE_URL);
    const onboarding = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
      });
      return { status: response.status, body: await response.text() };
    });
    if (![200, 201].includes(onboarding.status)) {
      throw new Error(`Could not complete the synthetic user's onboarding state: HTTP ${onboarding.status}.`);
    }
    session = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/me', { credentials: 'include' });
      return response.ok ? response.json() : null;
    });
    if (!session?.authenticated || session.appRole !== 'admin' || session.platformRole !== 'admin' || !session.user.onboardingCompleted) {
      throw new Error('Seeded screenshot account did not resolve to the expected authenticated admin session.');
    }
    fs.writeFileSync(path.join(output, 'seed.json'), JSON.stringify(seed, null, 2));
  }
  const manifest = [];
  for (const [index, entry] of routes.entries()) {
    const apiErrors = [];
    const recordApiError = (apiResponse) => {
      const url = new URL(apiResponse.url());
      if (url.pathname.startsWith('/api/v1/') && apiResponse.status() >= 400) {
        apiErrors.push({ status: apiResponse.status(), route: url.pathname });
      }
    };
    page.on('response', recordApiError);
    const response = await page.goto(origin + entry.path, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await waitForRenderedContent(page);
    const body = await page.locator('body').innerText().catch(() => 'Page did not render');
    const finalPath = new URL(page.url()).pathname;
    const redirected = finalPath !== entry.path;
    const renderedEntry = routes.find((candidate) => candidate.path === finalPath) ?? entry;
    const restricted = /session verification failed|admin access required|please sign in|login required/i.test(body);
    const waitingForSession = /preparing your workspace|loading your dashboard|loading your workspace|verifying session|finishing sign.in/i.test(body);
    const captureState = redirected ? 'redirected' : restricted ? 'restricted' : waitingForSession ? 'waiting-for-session' : 'rendered';
    const sharedPacks = membership(entry);
    const shared = sharedPacks.length > 1;
    const capabilityText = entry.owners.map((key) => {
      const capability = catalog.capabilities.find((item) => item.key === key);
      return capability ? `${key} — ${capability.description}` : key;
    }).join('; ');
    const personaActions = Object.entries(entry.actions ?? {})
      .map(([role, action]) => `${frontend.roleLabels[role] ?? role}: ${action}`)
      .join('\n');
    const filename = String(index + 1).padStart(2, '0') + '-' + entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
    await page.evaluate(({ edition, title, feature, contains, personaActions, isShared, sharedPacks, state, route, finalRoute, sessionLabel }) => {
      document.getElementById('pack-screenshot-label')?.remove();
      const banner = document.createElement('aside');
      banner.id = 'pack-screenshot-label';
      banner.setAttribute('aria-label', 'Screenshot annotation, not part of AlphaCI');
      Object.assign(banner.style, {
        position: 'relative', zIndex: '1', display: 'block',
        width: 'min(1080px, calc(100vw - 32px))', margin: '24px auto', padding: '14px 18px',
        color: '#f5f7fb', background: 'rgba(18, 24, 36, .96)',
        border: '1px solid rgba(170, 190, 220, .55)', borderRadius: '10px',
        boxShadow: '0 8px 28px rgba(0,0,0,.24)', font: '13px/1.5 system-ui, sans-serif',
      });
      const titleNode = document.createElement('strong');
      titleNode.textContent = edition + ' · ' + (state === 'redirected' ? 'Redirected screen · ' : '') + title;
      const details = document.createElement('div');
      details.style.marginTop = '5px';
      details.textContent = 'Feature owner: ' + feature;
      const contents = document.createElement('div');
      contents.style.marginTop = '3px';
      contents.textContent = 'Screen includes: ' + contains;
      const personaNode = document.createElement('div');
      personaNode.style.marginTop = '5px';
      personaNode.style.paddingTop = '5px';
      personaNode.style.borderTop = '1px solid rgba(170,190,220,.32)';
      const personaHeading = document.createElement('strong');
      personaHeading.textContent = 'Persona actions';
      const personaList = document.createElement('div');
      personaList.textContent = personaActions || 'No persona-specific actions recorded for this route.';
      Object.assign(personaList.style, { whiteSpace: 'pre-wrap', fontSize: '12px' });
      personaNode.append(personaHeading, personaList);
      const status = document.createElement('div');
      const packNames = sharedPacks.map((name) => ({ saas: 'SaaS', edu: 'EDU', enterprise: 'Enterprise' })[name]).join(' · ');
      const membershipText = isShared ? 'Shared across: ' + packNames : 'Pack-specific to: ' + packNames;
      const stateText = {
        redirected: 'Capture state: redirected by the app',
        restricted: sessionLabel ? 'Capture state: authenticated; route or action remains authorization-gated' : 'Capture state: guest view; sign-in or role access required',
        'waiting-for-session': 'Capture state: waiting for API data',
        rendered: 'Capture state: rendered',
      }[state];
      status.textContent = membershipText + ' · ' + stateText;
      status.style.marginTop = '5px';
      const routeNode = document.createElement('div');
      routeNode.textContent = state === 'redirected' ? 'Requested ' + route + ' → rendered ' + finalRoute : route;
      routeNode.style.opacity = '.76';
      routeNode.style.fontFamily = 'ui-monospace, monospace';
      routeNode.style.fontSize = '11px';
      if (sessionLabel) {
        const sessionNode = document.createElement('div');
        sessionNode.style.marginTop = '5px';
        sessionNode.textContent = sessionLabel;
        banner.append(titleNode, details, contents, personaNode, sessionNode, status, routeNode);
      } else {
        banner.append(titleNode, details, contents, personaNode, status, routeNode);
      }
      document.body.appendChild(banner);
    }, {
      edition: labels[pack],
      title: redirected ? renderedEntry.title : entry.title,
      feature: capabilityText,
      contains: entry.contains,
      personaActions,
      isShared: shared,
      sharedPacks,
      state: captureState,
      route: entry.path,
      finalRoute: finalPath,
      sessionLabel: session ? `Authenticated API session · ${session.user.login} · ${session.appRole} · seeded ${seed.workspace.name}` : '',
    });
    const file = path.join(output, filename);
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    page.off('response', recordApiError);
    manifest.push({ pack, route: entry.path, finalRoute: finalPath, title: entry.title, shared, sharedPacks, captureState, authenticated, sessionLogin: session?.user?.login ?? null, appRole: session?.appRole ?? null, platformRole: session?.platformRole ?? null, dataset: seed?.dataset ?? null, httpStatus: response?.status() ?? null, apiErrors, screenshot: filename, featureOwners: entry.owners, featureDescriptions: capabilityText, includes: entry.contains, personaActions: entry.actions });
    console.log(JSON.stringify(manifest.at(-1)));
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close().catch(() => undefined);
  process.exitCode = 1;
});
