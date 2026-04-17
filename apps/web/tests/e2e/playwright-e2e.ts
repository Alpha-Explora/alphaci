import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium, firefox, webkit } from 'playwright';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const LOCAL_PAGE_MARKERS = ['Get started by editing', 'To get started, edit the page.tsx file.'];

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
  switch (name) {
    case 'firefox':
      return firefox.launch({ headless: true });
    case 'webkit':
      return webkit.launch({ headless: true });
    default:
      return chromium.launch({ headless: true });
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

async function main() {
  const port = process.env.PORT || '4173';
  const baseUrl = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
  const browserName = resolveBrowser(process.env.E2E_BROWSER || 'chromium');
  const isExternalTarget = Boolean(process.env.E2E_BASE_URL);
  const waitTimeoutMs = isExternalTarget ? 120_000 : 45_000;

  const app = isExternalTarget
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
