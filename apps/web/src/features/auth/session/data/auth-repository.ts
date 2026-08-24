import { ApiError } from "@/lib/api/request";
import {
  createGitHubLoginUrl as createLoginUrl,
  getAuthSession as fetchAuthSession,
  getPendingAccount as fetchPendingAccount,
  logout as requestLogout,
  restoreAccount as requestRestoreAccount,
  startFreshAccount as requestStartFreshAccount,
  warmupBackend as requestWarmupBackend,
} from "@/lib/api/auth";
import type {
  AuthMeResponse,
  PendingAccountResponse,
} from "@/lib/api/contracts";

import type { AuthSession } from "../model/auth-types";
import type { PendingAccount } from "../model/pending-account";

function mapSession(dto: AuthMeResponse): AuthSession {
  return {
    authenticated: dto.authenticated,
    user: { ...dto.user },
    subscription: { ...dto.subscription },
    platformRole: dto.platformRole,
    appRole: dto.appRole,
    appRoleSource: dto.appRoleSource,
  };
}

function mapPendingAccount(dto: PendingAccountResponse): PendingAccount {
  return {
    pending: dto.pending,
    login: dto.login,
    archivedAt: dto.archivedAt,
    purgeAt: dto.purgeAt,
    retentionDays: dto.retentionDays,
  };
}

export async function getCurrentSession(): Promise<AuthSession> {
  return mapSession(await fetchAuthSession());
}

export async function signOut(): Promise<void> {
  await requestLogout();
}

export async function getPendingAccount(): Promise<PendingAccount> {
  return mapPendingAccount(await fetchPendingAccount());
}

export async function restoreAccount(): Promise<void> {
  await requestRestoreAccount();
}

export async function startFreshAccount(): Promise<void> {
  await requestStartFreshAccount();
}

export const createGitHubLoginUrl = createLoginUrl;
export const warmupBackend = requestWarmupBackend;

export function isAuthApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function authErrorStatus(error: unknown): number | null {
  return isAuthApiError(error) ? error.status : null;
}
