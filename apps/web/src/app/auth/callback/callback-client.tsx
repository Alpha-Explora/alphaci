"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { ApiError, createGitHubLoginUrl, getAuthSession } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

type CallbackState = "checking" | "failed";

function toSafeNextPath(raw: string | null): string {
  if (!raw) {
    return "/home";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  return "/home";
}

const statusCopy: Record<string, string> = {
  success: "GitHub sign in complete. Finalizing your session...",
  mock: "GitHub mock login complete. Finalizing your session...",
  failed: "GitHub sign in failed. Please retry.",
  invalid_state: "The OAuth state token was invalid. Please retry sign in.",
  unavailable: "GitHub OAuth is unavailable in this environment.",
  dummy_not_found: "Requested dummy account does not exist in the backend seed data.",
};

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authStatus = searchParams.get("auth") ?? "success";
  const intent = searchParams.get("intent") === "signup" ? "signup" : "login";
  const nextPath = toSafeNextPath(searchParams.get("next"));
  const [state, setState] = useState<CallbackState>("checking");
  const [message, setMessage] = useState<string>(statusCopy[authStatus] ?? "Finalizing sign in...");

  const retryLoginHref = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent,
      next: nextPath,
    });

    return createGitHubLoginUrl(`/auth/callback?${callbackPath.toString()}`);
  }, [intent, nextPath]);

  useEffect(() => {
    let disposed = false;

    async function finalizeAuth() {
      try {
        const session = await getAuthSession();

        if (!session.authenticated) {
          throw new ApiError("Not authenticated", 401);
        }

        if (disposed) {
          return;
        }

        if (hasActiveSubscription(session)) {
          router.replace(nextPath);
        } else {
          router.replace("/subscribe");
        }
      } catch (error) {
        if (disposed) {
          return;
        }

        setState("failed");
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setMessage("Sign in did not complete. Please connect your GitHub account again.");
          return;
        }

        setMessage("We could not complete your sign in flow. Please retry in a moment.");
      }
    }

    if (
      authStatus === "failed" ||
      authStatus === "invalid_state" ||
      authStatus === "unavailable" ||
      authStatus === "dummy_not_found"
    ) {
      setState("failed");
      return;
    }

    void finalizeAuth();

    return () => {
      disposed = true;
    };
  }, [authStatus, nextPath, router]);

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <section className="section-card callback-card glass-panel">
        <p className="hero-kicker">GitHub {intent === "signup" ? "Sign Up" : "Login"}</p>
        <h1>{state === "checking" ? "Completing authentication" : "Authentication needs retry"}</h1>
        <p>{message}</p>

        <div className="hero-actions">
          {state === "failed" ? (
            <Link className="primary-button" href={retryLoginHref}>
              Retry GitHub sign in
            </Link>
          ) : null}

          <Link className="ghost-button" href="/">
            Return to landing
          </Link>
        </div>
      </section>
    </main>
  );
}
