import type { AuthMeResponse } from "./contracts";
import { getApiBaseUrl, request } from "./request";

export function createGitHubLoginUrl(returnTo: string): string {
  return `${getApiBaseUrl()}/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function getAuthSession(): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/auth/me");
}

export async function logout(): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export async function deleteAccount(): Promise<void> {
  await request<{ ok: boolean }>("/auth/account", {
    method: "DELETE",
  });
}

export async function completeOnboarding(): Promise<{ ok: boolean; onboardingCompleted: boolean }> {
  return request<{ ok: boolean; onboardingCompleted: boolean }>("/auth/onboarding/complete", {
    method: "POST",
  });
}

export async function warmupBackend(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(`${getApiBaseUrl()}/health`, { signal: controller.signal });
  } catch {
    // Intentionally swallowed — we only want the server to wake up.
  } finally {
    clearTimeout(timer);
  }
}
