"use client";

import "./hierarchy.css";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/components/layout/workspace-context";
import { useAuthSession } from "@/features/auth/session";
import type { AuthMeResponse } from "@/lib/api/contracts";
import { isGuest } from "@/features/auth/session";

/* ── Page shell ───────────────────────────────────────────────────────────────
 * Encapsulates the auth guard + AppNav + dashboard chrome used by every existing
 * page, so the nine hierarchy routes don't each repeat 60 lines of boilerplate.
 * Renders children as a function of the authenticated session.
 *
 * This lives apart from primitives.tsx on purpose. A page shell needs AppNav,
 * AppNav needs the workspace switcher, and the switcher needs the create-group
 * dialog — which is built from a primitive. Keeping the shell in the same
 * module as the primitives closed that loop, so neither end could be moved or
 * read on its own. A shell is not a primitive; the split says so.
 */
export function HierarchyPageShell({
  children,
}: {
  children: (session: AuthMeResponse) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, session, error, refresh, signOut, isSigningOut } =
    useAuthSession();

  useEffect(() => {
    if (status === "signed-out") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  if (status === "loading") {
    return <PipelineLoader label="Loading your workspace" />;
  }

  if (status === "signed-out") {
    return <PipelineLoader label="Redirecting to sign in" />;
  }

  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <h1>Session verification failed</h1>
            <p>{error ?? "We could not verify your session."}</p>
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const guest = isGuest(session);

  return (
    <WorkspaceProvider>
      <main className="dash-shell" suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <FlowBackground variant="calm" />
        <AppNav
          guest={guest}
          session={session}
          onLogout={() => void handleLogout()}
          isLoggingOut={isSigningOut}
        />
        <div id="main-content" className="dash-page-content">
          {session ? children(session) : null}
        </div>
      </main>
    </WorkspaceProvider>
  );
}
