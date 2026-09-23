/**
 * Same-origin API bridge. When API_PROXY_TARGET names the backend origin, the
 * FE host serves /api/v1/* by proxying it there, so the browser only ever talks
 * to one site and the session cookie is first-party. Browsers that block
 * third-party cookies (Safari, Brave, Firefox strict, incognito) otherwise drop
 * the backend's cross-site cookie and sign-in never completes.
 *
 * Pair it with NEXT_PUBLIC_API_BASE_URL=/api/v1. Unset means no rewrite and the
 * FE calls the backend directly, as before. Removed at the custom-domain
 * cutover (backend docs/runbooks/runbook-auth-custom-domain-cutover.md).
 */
export interface ApiProxyRewrite {
  source: string;
  destination: string;
}

export function apiProxyRewrites(target: string | undefined): ApiProxyRewrite[] {
  const raw = target?.trim();
  if (!raw) return [];

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`API_PROXY_TARGET must be an absolute backend origin (got "${raw}").`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`API_PROXY_TARGET must use http or https (got "${raw}").`);
  }

  // Accept the origin with or without the /api/v1 suffix, mirroring
  // normalizeApiBaseUrl in request.ts.
  const origin = `${url.origin}${url.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "")}`;
  return [{ source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` }];
}
