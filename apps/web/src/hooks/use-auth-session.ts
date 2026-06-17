"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, getAuthSession } from "@/lib/api/client";
import type { AuthMeResponse } from "@/lib/api/contracts";

export type AuthSessionStatus = "loading" | "signed-out" | "signed-in" | "error";

interface UseAuthSessionResult {
  status: AuthSessionStatus;
  session: AuthMeResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
}

function getFriendlyAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Please sign in with GitHub to continue.";
    }

    return `Session check failed with status ${error.status}.`;
  }

  return "Unable to verify your session right now.";
}

export function useAuthSession(): UseAuthSessionResult {
  const [status, setStatus] = useState<AuthSessionStatus>("loading");
  const [session, setSession] = useState<AuthMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const applySession = useCallback((current: AuthMeResponse) => {
    if (!current.authenticated) {
      setSession(null);
      setStatus("signed-out");
      setError(null);
      return;
    }

    setSession(current);
    setStatus("signed-in");
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    setStatus("loading");
    setError(null);

    try {
      const current = await getAuthSession();

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      applySession(current);
    } catch (cause) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        setSession(null);
        setStatus("signed-out");
        return;
      }

      setSession(null);
      setStatus("error");
      setError(getFriendlyAuthError(cause));
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    async function loadInitialSession() {
      try {
        const current = await getAuthSession();

        if (!active || requestVersion !== requestVersionRef.current) {
          return;
        }

        applySession(current);
      } catch (cause) {
        if (!active || requestVersion !== requestVersionRef.current) {
          return;
        }

        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
          setSession(null);
          setStatus("signed-out");
          return;
        }

        setSession(null);
        setStatus("error");
        setError(getFriendlyAuthError(cause));
      }
    }

    void loadInitialSession();

    return () => {
      active = false;
    };
  }, [applySession]);

  return {
    status,
    session,
    error,
    refresh,
  };
}
