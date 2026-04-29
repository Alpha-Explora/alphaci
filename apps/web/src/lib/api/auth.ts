import type { AuthMeResponse } from "./contracts";
import { getApiBaseUrl, request } from "./request";

export function createGitHubLoginUrl(returnTo: string): string {
  return `${getApiBaseUrl()}/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export function createGoogleLoginUrl(returnTo: string): string {
  return `${getApiBaseUrl()}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function getAuthSession(): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/auth/me");
}

export async function logout(): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}
