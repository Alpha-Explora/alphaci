"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, getAuthSession, logout } from "@/lib/api/client";
import type { AuthMeResponse } from "@/lib/api/contracts";

export type AuthSessionStatus = "loading" | "signed-out" | "signed-in" | "error";

interface UseAuthSessionResult {
  status: AuthSessionStatus;
  session: AuthMeResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
  /* Sign-out lives here rather than in each view. Nine surfaces were repeating
   * the same call-then-refresh-then-redirect dance, and a view that performs
   * I/O is exactly what the architecture's no-http-in-views rule forbids. */
  signOut: () => Promise<void>;
  isSigningOut: boolean;
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
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  // Re-read the session when the tab regains focus.
  //
  // appRole is derived from GitHub org team membership and can change while a
  // tab sits open (a promotion to `team-lead`, or — more importantly — a
  // removal from it). The backend already reads the role live on every
  // request, so authorization is never stale; this only keeps the UI honest,
  // so a promoted user sees their new capabilities without a hard reload and a
  // demoted one stops being shown actions that would now 403.
  //
  // Deliberately silent: it patches state in place rather than going through
  // refresh(), which would flip status to "loading" and flash every page's
  // loading state on every tab switch.
  useEffect(() => {
    function handleFocus() {
      if (document.visibilityState === "hidden") return;

      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;

      void getAuthSession()
        .then((current) => {
          if (requestVersion !== requestVersionRef.current) return;
          applySession(current);
        })
        .catch(() => {
          // A background refresh must never surface an error or sign the user
          // out — the next real request will handle a genuinely dead session.
        });
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await logout();
      await refresh();
    } finally {
      setIsSigningOut(false);
    }
  }, [refresh]);

  return {
    status,
    session,
    error,
    refresh,
    signOut,
    isSigningOut,
  };
}
