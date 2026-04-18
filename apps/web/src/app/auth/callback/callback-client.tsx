"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { ApiError, createGitHubLoginUrl, createGoogleLoginUrl, getAuthSession } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

type CallbackState = "checking" | "failed";
type OAuthProvider = "github" | "google";

function toSafeNextPath(raw: string | null): string {
  if (!raw) {
    return "/home";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  return "/home";
}

function toSafeProvider(raw: string | null): OAuthProvider {
  return raw === "google" ? "google" : "github";
}

function providerDisplayName(provider: OAuthProvider): "GitHub" | "Google" {
  return provider === "google" ? "Google" : "GitHub";
}

function statusMessage(authStatus: string, provider: OAuthProvider): string {
  const providerName = providerDisplayName(provider);

  switch (authStatus) {
    case "success":
      return `${providerName} sign in complete. Finalizing your session...`;
    case "failed":
      return `${providerName} sign in failed. Please retry.`;
    case "invalid_state":
      return "The OAuth state token was invalid. Please retry sign in.";
    case "unavailable":
      return `${providerName} OAuth is unavailable in this environment.`;
    default:
      return "Finalizing sign in...";
  }
}

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authStatus = searchParams.get("auth") ?? "success";
  const intent = searchParams.get("intent") === "signup" ? "signup" : "login";
  const nextPath = toSafeNextPath(searchParams.get("next"));
  const provider = toSafeProvider(searchParams.get("provider"));
  const providerName = providerDisplayName(provider);
  const [state, setState] = useState<CallbackState>("checking");
  const [message, setMessage] = useState<string>(statusMessage(authStatus, provider));

  const retryLoginHref = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent,
      next: nextPath,
      provider,
    });

    const returnTo = `/auth/callback?${callbackPath.toString()}`;
    return provider === "google" ? createGoogleLoginUrl(returnTo) : createGitHubLoginUrl(returnTo);
  }, [intent, nextPath, provider]);

  useEffect(() => {
    setMessage(statusMessage(authStatus, provider));
  }, [authStatus, provider]);

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
          setMessage(`Sign in did not complete. Please connect your ${providerName} account again.`);
          return;
        }

        setMessage("We could not complete your sign in flow. Please retry in a moment.");
      }
    }

    if (
      authStatus === "failed" ||
      authStatus === "invalid_state" ||
      authStatus === "unavailable"
    ) {
      setState("failed");
      return;
    }

    void finalizeAuth();

    return () => {
      disposed = true;
    };
  }, [authStatus, nextPath, providerName, router]);

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <section className="section-card callback-card glass-panel">
        <p className="hero-kicker">{providerName} {intent === "signup" ? "Sign Up" : "Login"}</p>
        <h1>{state === "checking" ? "Completing authentication" : "Authentication needs retry"}</h1>
        <p>{message}</p>

        <div className="hero-actions">
          {state === "failed" ? (
            <Link className="primary-button" href={retryLoginHref}>
              Retry {providerName} sign in
            </Link>
          ) : null}

          <Link className="ghost-button" href="/">
            Return to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
