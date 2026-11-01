import { apiErrorMessage } from "./error-message";

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

function resolveApiBaseUrl(): string {
  const canonicalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (canonicalApiBaseUrl) {
    return normalizeApiBaseUrl(canonicalApiBaseUrl);
  }

  const legacyApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (legacyApiUrl) {
    // NEXT_PUBLIC_API_BASE_URL is the canonical var. NEXT_PUBLIC_API_URL is a
    // legacy alias we still honor so existing deployments keep working — but we
    // warn so the env can be migrated. We deliberately do NOT throw here:
    // this runs at module load, including during `next build` prerendering, so
    // throwing would crash the entire production build instead of degrading.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "NEXT_PUBLIC_API_URL is a legacy alias; set NEXT_PUBLIC_API_BASE_URL " +
          "to the active backend URL to silence this warning.",
      );
    }
    return normalizeApiBaseUrl(legacyApiUrl);
  }

  // Neither var was present AT BUILD TIME. NEXT_PUBLIC_* values are inlined by
  // Next.js during `next build`, so this localhost default gets permanently
  // baked into the deployed bundle — every API call and the login button then
  // point at the visitor's own machine (ERR_CONNECTION_REFUSED). We can't throw
  // here (this module loads during prerender and throwing would fail the whole
  // build), so we surface it as loudly as possible instead: this shows in both
  // the Vercel build log and the browser console.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[api] Neither NEXT_PUBLIC_API_BASE_URL nor NEXT_PUBLIC_API_URL was set " +
        "at build time — falling back to http://localhost:4000. Login and all " +
        "API calls will fail in this deployment. Set NEXT_PUBLIC_API_BASE_URL " +
        "to the backend URL in this environment's settings and REDEPLOY " +
        "(the value is inlined at build time, so setting it without rebuilding " +
        "has no effect).",
    );
  }

  return normalizeApiBaseUrl("http://localhost:4000/api/v1");
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  details: unknown;
  correlationId?: string;

  constructor(message: string, status: number, details?: unknown, correlationId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.correlationId = correlationId;
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * A multipart body (a file upload) carries its own Content-Type with the
 * boundary the browser picks; forcing JSON's would break it.
 */
function isMultipart(body: RequestInit["body"]): boolean {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function fetchWithSession(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(isMultipart(init?.body) ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (cause) {
    // Cancellation is intentional and must remain recognizable to callers.
    if (init?.signal?.aborted || (cause instanceof Error && cause.name === "AbortError")) throw cause;
    throw new ApiError(apiErrorMessage(0), 0);
  }
}

async function readErrorDetails(response: Response): Promise<unknown> {
  try {
    if (typeof response.text === "function") {
      const responseText = await response.text();
      try {
        return responseText ? JSON.parse(responseText) : undefined;
      } catch {
        return responseText;
      }
    } else if (typeof response.json === "function") {
      return await response.json();
    }
  } catch {
    // A broken error body must not replace the useful HTTP failure.
  }
}

function errorReference(response: Response, details: unknown): string | undefined {
  const bodyReference = details && typeof details === "object" && "correlationId" in details
    ? details.correlationId : undefined;
  const reference = response.headers?.get("x-correlation-id") ?? bodyReference;
  return typeof reference === "string" && /^[\w-]{1,128}$/.test(reference)
    ? reference : undefined;
}

/** Fetch with the session cookie, throwing ApiError on any non-2xx reply. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetchWithSession(path, init);
  if (!response.ok) {
    const details = await readErrorDetails(response);
    throw new ApiError(apiErrorMessage(response.status, details), response.status, details, errorReference(response, details));
  }
  return response;
}

/**
 * A plain-text body (Markdown, CSV…). Same cookie, headers and ApiError as
 * `request`; a reply sent as a download (Content-Disposition: attachment) is
 * still readable here — the attachment header only matters to navigation.
 */
export async function requestText(path: string, init?: RequestInit): Promise<string> {
  const response = await send(path, init);
  if (response.status === 204) return "";
  return response.text();
}

/** A binary body (an image). Same cookie and ApiError as `request`. */
export async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await send(path, init);
  return response.blob();
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);

  if (response.status === 204) {
    return undefined as T;
  }

  // Void endpoints (e.g. PATCH /admin/users/:id/app-role) reply 200 with an
  // EMPTY body, not 204. response.json() then rejects with a SyntaxError that
  // callers surfaced as a spurious "unexpected error" even though the write
  // succeeded. Treat an unparseable body on a SUCCESSFUL response as "no
  // content" rather than a failure.
  try {
    return (await response.json()) as T;
  } catch {
    return undefined as T;
  }
}
