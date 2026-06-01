"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { isGuest } from "@/lib/auth/subscription";

export default function SettingsPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed-out") {
      router.push("/login?next=/settings");
    }
  }, [status, router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage(null);
    try {
      await logout();
      await refresh();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>Loading settings...</h1>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>We could not verify your session.</h1>
          <p className="helper-text">Please retry or return to Home.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => void refresh()}>
              Retry session check
            </button>
            <Link className="ghost-button" href="/login?next=/settings">Go to login</Link>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </main>
    );
  }

  if (status === "signed-out") {
    // Redirect is handled in the useEffect above; show nothing while navigating
    return null;
  }

  const guest = isGuest(session);
  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav">
        <div className="brand-mark">
          <PipelineLogo size={22} />
          <span>FlowCI Studio</span>
        </div>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/home">Dashboard</Link>
          <Link href="/workflows">Workflows</Link>
          {guest
            ? <Link href="/subscribe">Billing</Link>
            : <Link href="/settings">Settings</Link>}
        </nav>
        {!guest && (
          <button className="ghost-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        )}
      </header>

      {/* ── Account settings ───────────────────────────────────── */}
      <section className="section-card glass-panel" style={{ padding: "clamp(1.5rem, 2.5vw, 2rem)" }}>
        <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>settings/account.yml</p>
        <h1 style={{ fontSize: "clamp(1.3rem, 2vw, 1.6rem)", margin: "0 0 1.5rem", fontWeight: 800 }}>
          Account settings
        </h1>

        {/* Account identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", marginBottom: "1.5rem" }}>
          {session?.user.avatarUrl ? (
            <Image
              src={session.user.avatarUrl}
              alt={session.user.name ?? session.user.login}
              className="user-avatar"
              width={52}
              height={52}
              unoptimized
            />
          ) : (
            <span className="user-avatar-placeholder" aria-hidden="true">{avatarInitial}</span>
          )}
          <div style={{ display: "grid", gap: "0.15rem" }}>
            <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>
              {session?.user.name ?? session?.user.login ?? "—"}
            </strong>
            {session?.user.login && session?.user.name && (
              <span style={{ fontSize: "0.84rem", color: "var(--text-muted)" }}>
                @{session.user.login}
              </span>
            )}
            {session?.user.email && (
              <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                {session.user.email}
              </span>
            )}
          </div>
        </div>

        {/* Subscription plan */}
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.72rem",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-soft)",
          marginBottom: "1rem",
        }}>
          <p style={{ margin: "0 0 0.2rem", fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Current plan
          </p>
          <p style={{ margin: 0, fontSize: "0.96rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {session?.subscription.plan ?? "—"}
            {session?.subscription.status ? (
              <span style={{ marginLeft: "0.5rem", fontSize: "0.78rem", fontWeight: 400, color: "var(--text-secondary)" }}>
                ({session.subscription.status})
              </span>
            ) : null}
          </p>
        </div>

        {/* GitHub connection */}
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.72rem",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-soft)",
          marginBottom: "1rem",
        }}>
          <p style={{ margin: "0 0 0.2rem", fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            GitHub App
          </p>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Manage your GitHub App connection from the{" "}
            <Link href="/workflows" style={{ color: "var(--brand)", textDecoration: "underline" }}>
              Create Project
            </Link>{" "}
            page.
          </p>
        </div>

        {/* Billing link */}
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.72rem",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-soft)",
          marginBottom: "1.5rem",
        }}>
          <p style={{ margin: "0 0 0.2rem", fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Billing
          </p>
          <Link
            href="/subscribe"
            style={{ fontSize: "0.9rem", color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}
          >
            View or change your subscription plan →
          </Link>
        </div>

        {/* Sign out */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            className="ghost-button"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{ alignSelf: "flex-start" }}
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
          {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
