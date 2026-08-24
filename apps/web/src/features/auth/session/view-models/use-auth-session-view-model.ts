"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  authErrorStatus,
  getCurrentSession,
  signOut as requestSignOut,
} from "../data/auth-repository";
import type { AuthSession } from "../model/auth-types";

export type AuthSessionStatus = "loading" | "signed-out" | "signed-in" | "error";

export interface AuthSessionViewModel {
  status: AuthSessionStatus;
  session: AuthSession | null;
  error: string | null;
  refresh: () => Promise<void>;
  /* Sign-out lives here rather than in each view. Nine surfaces were repeating
   * the same call-then-refresh-then-redirect dance, and a view that performs
   * I/O is exactly what the architecture's no-http-in-views rule forbids. */
  signOut: () => Promise<void>;
  isSigningOut: boolean;
}

function getFriendlyAuthError(error: unknown): string {
  const status = authErrorStatus(error);
  if (status !== null) {
    if (status === 401 || status === 403) {
      return "Please sign in with GitHub to continue.";
    }

    return `Session check failed with status ${status}.`;
  }

  return "Unable to verify your session right now.";
}

export function useAuthSessionViewModel(): AuthSessionViewModel {
  const [status, setStatus] = useState<AuthSessionStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const requestVersionRef = useRef(0);

  const applySession = useCallback((current: AuthSession) => {
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
      const current = await getCurrentSession();

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      applySession(current);
    } catch (cause) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      const status = authErrorStatus(cause);
      if (status === 401 || status === 403) {
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
        const current = await getCurrentSession();

        if (!active || requestVersion !== requestVersionRef.current) {
          return;
        }

        applySession(current);
      } catch (cause) {
        if (!active || requestVersion !== requestVersionRef.current) {
          return;
        }

        const status = authErrorStatus(cause);
        if (status === 401 || status === 403) {
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

      void getCurrentSession()
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
      await requestSignOut();
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
