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

  return normalizeApiBaseUrl("http://localhost:4000/api/v1");
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let details: unknown;
    if (typeof response.text === "function") {
      const responseText = await response.text();
      try {
        details = responseText ? JSON.parse(responseText) : undefined;
      } catch {
        details = responseText;
      }
    } else if (typeof response.json === "function") {
      details = await response.json();
    }

    throw new ApiError(`Request failed with status ${response.status}`, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
