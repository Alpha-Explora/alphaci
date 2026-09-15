"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  createGitHubLoginUrl,
  useAuthSessionViewModel,
  warmupBackend,
  getAuthenticatedRedirectPath,
} from "@/features/auth/session";

import { toSafeNextPath } from "../model/login-rules";

export interface OAuthLoginViewModel {
  status: ReturnType<typeof useAuthSessionViewModel>["status"];
  isWarming: boolean;
  githubLoginHref: string;
  handleLogin: (event: React.MouseEvent<HTMLAnchorElement>) => Promise<void>;
}

export function useOAuthLoginViewModel(
  mode: "login" | "signup",
): OAuthLoginViewModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, session } = useAuthSessionViewModel();
  const [isWarming, setIsWarming] = useState(false);
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

  return { status, isWarming, githubLoginHref, handleLogin };
}
