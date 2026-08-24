"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  authErrorStatus,
  createGitHubLoginUrl,
  getAuthenticatedRedirectPath,
  getCurrentSession,
  getPendingAccount,
  isAuthApiError,
  restoreAccount,
  startFreshAccount,
} from "@/features/auth/session";
import type { PendingAccount } from "@/features/auth/session";

import {
  providerDisplayName,
  statusMessage,
  toSafeNextPath,
  toSafeProvider,
  type CallbackState,
  type OAuthProvider,
} from "../model/callback-rules";

export interface AuthCallbackViewModel {
  status: CallbackState;
  state: CallbackState;
  message: string;
  authStatus: string;
  intent: "login" | "signup";
  nextPath: string;
  provider: OAuthProvider;
  providerName: "GitHub" | "Google";
  orgLogin: string | null;
  pendingAccount: PendingAccount | null;
  pendingSessionExpired: boolean;
  retryLoginHref: string;
  onRestore: () => Promise<void>;
  onStartFresh: () => Promise<void>;
}

const failedStatuses = new Set([
  "failed",
  "invalid_state",
  "unavailable",
  "not_authorized",
  "org_verification_failed",
]);

export function useAuthCallbackViewModel(): AuthCallbackViewModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authStatus = searchParams.get("auth") ?? "success";
  const intent = searchParams.get("intent") === "signup" ? "signup" : "login";
  const nextPath = toSafeNextPath(searchParams.get("next"));
  const provider = toSafeProvider(searchParams.get("provider"));
  const providerName = providerDisplayName(provider);
  const orgLogin = searchParams.get("org");
  const [state, setState] = useState<CallbackState>(() =>
    failedStatuses.has(authStatus) ? "failed" : "checking",
  );
  const [message, setMessage] = useState(() => statusMessage(authStatus, provider));
  const [pendingAccount, setPendingAccount] = useState<PendingAccount | null>(null);
  const [pendingSessionExpired, setPendingSessionExpired] = useState(false);
  const disposedRef = useRef(false);

  const retryLoginHref = useMemo(() => {
    const callbackPath = new URLSearchParams({ intent, next: nextPath, provider });
    return createGitHubLoginUrl(`/auth/callback?${callbackPath.toString()}`);
  }, [intent, nextPath, provider]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (failedStatuses.has(authStatus)) {
      return;
    }

    if (authStatus === "archived_choice") {
      void getPendingAccount()
        .then((data) => {
          if (disposedRef.current) return;
          if (!data.pending) setPendingSessionExpired(true);
          else setPendingAccount(data);
          setState("archived_choice");
        })
        .catch(() => {
          if (disposedRef.current) return;
          setPendingSessionExpired(true);
          setState("archived_choice");
        });
      return;
    }

    void getCurrentSession()
      .then((session) => {
        if (disposedRef.current) return;
        if (!session.authenticated) {
          setState("failed");
          setMessage(`Sign in did not complete. Please connect your ${providerName} account again.`);
          return;
        }
        const redirectPath = getAuthenticatedRedirectPath(session, nextPath);
        if (redirectPath) router.replace(redirectPath);
      })
      .catch((error: unknown) => {
        if (disposedRef.current) return;
        setState("failed");
        if (isAuthApiError(error) && (authErrorStatus(error) === 401 || authErrorStatus(error) === 403)) {
          setMessage(`Sign in did not complete. Please connect your ${providerName} account again.`);
          return;
        }
        setMessage("We could not complete your sign in flow. Please retry in a moment.");
      });
  }, [authStatus, nextPath, providerName, router]);

  const onRestore = useCallback(async () => {
    await restoreAccount();
    router.replace(nextPath);
  }, [nextPath, router]);

  const onStartFresh = useCallback(async () => {
    await startFreshAccount();
    router.replace(nextPath);
  }, [nextPath, router]);

  return {
    status: state,
    state,
    message,
    authStatus,
    intent,
    nextPath,
    provider,
    providerName,
    orgLogin,
    pendingAccount,
    pendingSessionExpired,
    retryLoginHref,
    onRestore,
    onStartFresh,
  };
}
