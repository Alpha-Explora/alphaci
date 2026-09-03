"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

import type { useAuthSession } from "@/features/auth/session";

import { sectionVariants } from "./motion";

type DashboardSession = ReturnType<typeof useAuthSession>["session"];

function HomeHeaderAvatar({
  session,
}: Readonly<{ session: DashboardSession }>) {
  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();
  if (session?.user.avatarUrl) {
    return (
      <Image
        src={session.user.avatarUrl}
        alt={session.user.name ?? session.user.login}
        className="home-header-avatar"
        width={40}
        height={40}
        unoptimized
      />
    );
  }
  return (
    <span
      className="home-header-avatar home-header-avatar--fallback"
      aria-hidden="true"
    >
      {avatarInitial}
    </span>
  );
}

function HomeHeaderIdentity({
  guest,
  session,
}: Readonly<{
  guest: boolean;
  session: DashboardSession;
}>) {
  return (
    <div className="home-header-id">
      {!guest ? <HomeHeaderAvatar session={session} /> : null}
      <div className="home-header-copy">
        <p className="home-header-eyebrow">SYSTEM.DASHBOARD</p>
        <h1 className="home-header-title">
          {guest
            ? "ALPHACI Dashboard"
            : `Welcome back, ${session?.user.name ?? session?.user.login ?? "builder"}.`}
        </h1>
      </div>
    </div>
  );
}

function HomeHeaderActions({
  guest,
  canCreateProjects,
  onRefresh,
}: Readonly<{
  guest: boolean;
  canCreateProjects: boolean;
  onRefresh: () => void;
}>) {
  if (guest) {
    return (
      <div className="home-header-actions">
        <Link className="primary-button home-header-btn" href="/signup">
          Sign up free
        </Link>
        <Link className="ghost-button home-header-btn" href="/login">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="home-header-actions">
      <button
        className="ghost-button home-header-btn"
        type="button"
        onClick={onRefresh}
      >
        Refresh
      </button>
      {canCreateProjects ? (
        <Link
          className="primary-button home-header-btn"
          href="/workflows?tab=setup"
        >
          Create project
        </Link>
      ) : null}
    </div>
  );
}

export function HomeDashboardHeader({
  guest,
  session,
  canCreateProjects,
  prefersReducedMotion,
  error,
  logoutMessage,
  onRefresh,
}: Readonly<{
  guest: boolean;
  session: DashboardSession;
  canCreateProjects: boolean;
  prefersReducedMotion: boolean | null;
  error: string | null;
  logoutMessage: string | null;
  onRefresh: () => void;
}>) {
  return (
    <motion.section
      className="welcome-banner-flat home-header"
      aria-label="Welcome"
      custom={0}
      variants={sectionVariants}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
    >
      <div className="welcome-banner-flat-accent" aria-hidden="true" />

      <div className="home-header-row">
        <HomeHeaderIdentity guest={guest} session={session} />
        <HomeHeaderActions
          guest={guest}
          canCreateProjects={canCreateProjects}
          onRefresh={onRefresh}
        />
      </div>

      {error ? <p className="error-text home-header-msg">{error}</p> : null}
      {logoutMessage ? (
        <p className="error-text home-header-msg">{logoutMessage}</p>
      ) : null}
    </motion.section>
  );
}

export function GuestPreviewBanner() {
  return (
    <div
      className="guest-banner glass-panel"
      role="alert"
      style={{
        background:
          "linear-gradient(135deg, rgba(88, 166, 255, 0.08) 0%, rgba(17, 17, 22, 0.7) 100%)",
        border: "1px solid var(--border-brand)",
        padding: "1rem var(--layout-gutter)",
        borderRadius: "0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--text-primary)",
          fontWeight: 500,
          fontSize: "0.88rem",
        }}
      >
        You are viewing ALPHACI in preview mode. Sign up to unlock all
        features.
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Link
          className="primary-button"
          href="/signup"
          style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}
        >
          Sign up free
        </Link>
        <Link
          className="ghost-button"
          href="/login"
          style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}
        >
          Log in
        </Link>
      </div>
    </div>
  );
}

export function DashboardLoadErrors({
  message,
  onRetry,
}: Readonly<{
  message: string;
  onRetry: () => void;
}>) {
  return (
    <div className="dashboard-load-errors" role="alert">
      <span aria-hidden="true">!</span>
      <p>{message}</p>
      <button className="error-retry-btn" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
