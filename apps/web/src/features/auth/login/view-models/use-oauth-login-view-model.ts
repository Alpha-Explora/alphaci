"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  authErrorStatus,
  createGitHubLoginUrl,
  devQuickLogin,
  useAuthSessionViewModel,
  warmupBackend,
  getAuthenticatedRedirectPath,
} from "@/features/auth/session";
import { getApiBaseUrl } from "@/shared/api/request";

import { toSafeNextPath } from "../model/login-rules";
import { canUseDevQuickLogin } from "../model/dev-quick-login";

export interface OAuthLoginViewModel {
  status: ReturnType<typeof useAuthSessionViewModel>["status"];
  isWarming: boolean;
  githubLoginHref: string;
  handleLogin: (event: React.MouseEvent<HTMLAnchorElement>) => Promise<void>;
  canQuickLogin: boolean;
  isQuickLoggingIn: boolean;
  quickLoginError: string | null;
  handleQuickLogin: () => Promise<void>;
}

export function useOAuthLoginViewModel(
  mode: "login" | "signup",
): OAuthLoginViewModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, session, refresh } = useAuthSessionViewModel();
  const [isWarming, setIsWarming] = useState(false);
  const [isQuickLoggingIn, setIsQuickLoggingIn] = useState(false);
  const [quickLoginError, setQuickLoginError] = useState<string | null>(null);
  const [browserOrigin, setBrowserOrigin] = useState<string | null>(null);

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  const nextPath = useMemo(
    () => toSafeNextPath(searchParams.get("next")),
    [searchParams],
  );
  const githubCallbackReturnTo = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent: mode,
      next: nextPath,
      provider: "github",
    });
    const relativeCallbackPath = `/auth/callback?${callbackPath.toString()}`;
    return browserOrigin
      ? `${browserOrigin}${relativeCallbackPath}`
      : relativeCallbackPath;
  }, [browserOrigin, mode, nextPath]);

  const githubLoginHref = useMemo(
    () => createGitHubLoginUrl(githubCallbackReturnTo),
    [githubCallbackReturnTo],
  );

  const canQuickLogin = canUseDevQuickLogin({
    nodeEnv: process.env.NODE_ENV,
    featureFlag: process.env.NEXT_PUBLIC_DEV_QUICK_LOGIN,
    browserOrigin,
    apiBaseUrl: getApiBaseUrl(),
    apiBaseUrlConfigured: Boolean(
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL,
    ),
  });

  useEffect(() => {
    if (status !== "signed-in") return;
    const redirectPath = getAuthenticatedRedirectPath(session, nextPath);
    if (redirectPath) router.replace(redirectPath);
  }, [nextPath, router, session, status]);

  const handleLogin = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setIsWarming(true);
      try {
        await warmupBackend();
      } catch {
        // Warmup is opportunistic; it must never block OAuth navigation.
      } finally {
        setIsWarming(false);
      }
      window.location.href = githubLoginHref;
    },
    [githubLoginHref],
  );

  const handleQuickLogin = useCallback(async () => {
    if (!canQuickLogin || isQuickLoggingIn) return;

    setIsQuickLoggingIn(true);
    setQuickLoginError(null);
    try {
      await devQuickLogin();
      await refresh();
    } catch (cause) {
      const statusCode = authErrorStatus(cause);
      setQuickLoginError(
        statusCode === 404
          ? "Quick login is not enabled for this local environment."
          : "Unable to start the local development session.",
      );
    } finally {
      setIsQuickLoggingIn(false);
    }
  }, [canQuickLogin, isQuickLoggingIn, refresh]);

  return {
    status,
    isWarming,
    githubLoginHref,
    handleLogin,
    canQuickLogin,
    isQuickLoggingIn,
    quickLoginError,
    handleQuickLogin,
  };
}
