"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { SubscriptionCongratsModal } from "@/components/product/subscription-congrats-modal";
import { useAuthSession } from "@/hooks/use-auth-session";
import { activateMonthlySubscription, cancelMonthlySubscription } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const CONGRATS_SESSION_KEY = "flowci_congrats_shown";

const proPlan = {
  key: "pro" as const,
  title: "Pro Monthly",
  amount: "300",
  summary: "For builders shipping service pipelines every week.",
  features: [
    "Unlimited workflow generation",
    "Advanced approval toggles",
    "Template updates as soon as they ship",
    "Workflow history synced to your account",
    "GitHub repository creation with branch rulesets",
  ],
};

const activationChecklist = [
  "Connect your GitHub account",
  "Activate Pro Monthly",
  "Open Create Project",
  "Create a GitHub project with managed CI",
];

const featureRows = [
  { name: "Workflow generation", pro: true },
  { name: "Template access",     pro: true },
  { name: "Workflow history",    pro: true },
  { name: "GitHub integration",  pro: true },
  { name: "Repo + branch setup", pro: true },
];

function CheckIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function SubscribePage() {
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(CONGRATS_SESSION_KEY)) {
      setShowCongratsModal(false);
    }
  }, []);

  const hasSubscription = hasActiveSubscription(session);
  const activePlan = session?.subscription.plan;
  const isCurrentPlanActive = hasSubscription && activePlan === "pro";

  let activateButtonLabel = "Activate Pro Monthly";
  if (isSubmitting) {
    activateButtonLabel = "Processing...";
  } else if (isCurrentPlanActive) {
    activateButtonLabel = "Current plan active";
  }

  async function handleActivate() {
    setStatusMessage(null);
    setActionError(null);
    setIsSubmitting(true);

    try {
      await activateMonthlySubscription("pro");
      await refresh();
      setStatusMessage("Pro monthly plan is active. Your workspace is ready.");
      if (typeof window !== "undefined" && !sessionStorage.getItem(CONGRATS_SESSION_KEY)) {
        setShowCongratsModal(true);
      }
    } catch {
      setActionError("Subscription activation failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setStatusMessage(null);
    setActionError(null);
    setIsSubmitting(true);

    try {
      await cancelMonthlySubscription();
      await refresh();
      setStatusMessage("Monthly subscription canceled.");
    } catch {
      setActionError("Cancel request failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCongratsClose() {
    setShowCongratsModal(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CONGRATS_SESSION_KEY, "1");
    }
  }

  return (
    <main className="flow-shell page-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <FlowBackground />

      <header className="marketing-nav">
        <div className="brand-mark">
          <PipelineLogo size={22} />
          <span>FlowCI Studio</span>
        </div>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/workflows">Workflows</Link>
        </nav>
        <Link className="ghost-button" href="/">
          Back to Home
        </Link>
      </header>

      <div id="main-content">
        <div style={{ padding: "clamp(3rem,6vw,5rem) clamp(2rem,6vw,5rem) 2rem", maxWidth: 900, margin: "0 auto" }}>
          <p className="file-path-label">billing/plans.yml</p>
          <motion.p
            className="hero-kicker"
            style={{ marginTop: "1rem" }}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          >
            Billing
          </motion.p>
          <motion.h1
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: "clamp(2.2rem,5vw,3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0.4rem 0 0.8rem" }}
          >
            One plan. Everything you need.
          </motion.h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 580, margin: 0, lineHeight: 1.6 }}>
            Connect your GitHub account, activate Pro Monthly, and unlock project creation,
            workflow generation, and repository setup with branch rulesets.
          </p>

          <div className="status-pill-row" style={{ marginTop: "1.2rem" }}>
            <span className="status-pill">Currency: PHP</span>
            <span className="status-pill">
              Status: {session?.subscription.status ?? (status === "signed-in" ? "inactive" : "guest")}
            </span>
            <span className="status-pill">Plan: {activePlan ?? "free"}</span>
          </div>
        </div>

        <div style={{ padding: "0 clamp(2rem,6vw,5rem) 2rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <p className="section-divider" style={{ marginBottom: "1.5rem" }}>plan</p>

          <div className="pricing-table-single">
            <div className="pricing-plan-card">
              <div className="pricing-plan-header">
                <div>
                  <p className="pricing-table-plan-label">{proPlan.title}</p>
                  <p className="pricing-table-price">&#8369;{proPlan.amount}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.2rem 0 0.5rem" }}>per month</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>{proPlan.summary}</p>
                </div>
                {hasSubscription && activePlan === "pro" && (
                  <span className="status-pill" style={{ alignSelf: "flex-start" }}>Active</span>
                )}
              </div>

              <ul className="pricing-feature-list">
                {proPlan.features.map((feat) => (
                  <li key={feat} className="pricing-feature-item">
                    <CheckIcon />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pricing-comparison">
              <p className="section-divider" style={{ marginBottom: "1rem" }}>what&apos;s included</p>
              {featureRows.map((row) => (
                <div key={row.name} className="pricing-comparison-row">
                  <span className="pricing-comparison-feature">{row.name}</span>
                  <span className={`pricing-comparison-check${row.pro ? " active" : ""}`}>
                    {row.pro ? <CheckIcon /> : <span style={{ color: "var(--text-muted)" }}>&#8212;</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "2rem clamp(2rem,6vw,5rem)", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <p className="section-divider" style={{ marginBottom: "1.5rem" }}>activate</p>
          <h2 style={{ fontSize: "clamp(1.4rem,2.5vw,2rem)", marginBottom: "0.6rem" }}>Activate Pro Monthly</h2>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 1.2rem" }}>
            Pro Monthly at <strong>&#8369;300/month</strong>. Cancel any time.
          </p>

          <ol className="subscription-checklist">
            {activationChecklist.map((item, index) => (
              <li key={item}>
                <span className="checklist-step" aria-hidden="true">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>

          <div className="hero-actions" style={{ marginTop: "1.2rem" }}>
            {status === "signed-out" ? (
              <>
                <Link className="primary-button" href="/signup">
                  Sign up with GitHub first
                </Link>
                <Link className="ghost-button" href="/login">
                  Already have an account? Log in
                </Link>
              </>
            ) : null}

            {status === "signed-in" ? (
              <>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSubmitting || isCurrentPlanActive}
                  onClick={() => void handleActivate()}
                >
                  {activateButtonLabel}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isSubmitting || !hasSubscription}
                  onClick={() => void handleCancel()}
                >
                  Cancel subscription
                </button>
              </>
            ) : null}

            <Link className="ghost-button" href="/workflows">
              Create Project
            </Link>
          </div>
          {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}
        </div>

        <div style={{ padding: "2rem clamp(2rem,6vw,5rem) clamp(3rem,6vw,5rem)", maxWidth: 900, margin: "0 auto", width: "100%", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>billing/notes.md</p>
          <h2 style={{ fontSize: "clamp(1.2rem,2vw,1.6rem)", marginBottom: "0.75rem" }}>Billing notes</h2>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 0.75rem", lineHeight: 1.6 }}>
            This billing flow is environment-backed for product testing. Activate Pro Monthly and validate
            entitlement changes immediately in Create Project.
          </p>
          <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            If your status updates but UI still shows old data, run a session refresh by revisiting
            login or home.
          </p>

          {status === "loading" ? <p className="helper-text" style={{ marginTop: "0.75rem" }}>Checking your account status...</p> : null}
          {error ? <p className="error-text" style={{ marginTop: "0.75rem" }}>{error}</p> : null}
          {statusMessage ? <p className="helper-text" style={{ marginTop: "0.75rem" }}>{statusMessage}</p> : null}
        </div>
      </div>

      {showCongratsModal ? (
        <SubscriptionCongratsModal
          planName={proPlan.title}
          onClose={handleCongratsClose}
        />
      ) : null}
    </main>
  );
}
