"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { activateMonthlySubscription, cancelMonthlySubscription } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const planCatalog = [
  {
    key: "pro" as const,
    title: "Pro Monthly",
    amount: "300",
    summary: "Best for individual builders shipping service pipelines every week.",
    features: [
      "Unlimited workflow generation",
      "Advanced approval toggles",
      "Template updates as soon as they ship",
      "Workflow history synced to your account",
    ],
  },
  {
    key: "enterprise" as const,
    title: "Enterprise Monthly",
    amount: "1200",
    summary: "For teams managing multiple services and stricter release controls.",
    features: [
      "Everything in Pro",
      "Priority support queue",
      "Governance-focused workflow defaults",
      "Faster turnaround for template requests",
    ],
  },
];

const activationChecklist = [
  "Connect your Google or GitHub account",
  "Pick monthly plan",
  "Activate and open Create Project",
  "Create a GitHub project with managed CI",
];

/* Feature comparison rows for the pricing table */
const featureRows = [
  { name: "Workflow generation",  pro: true,  enterprise: true  },
  { name: "Template access",      pro: true,  enterprise: true  },
  { name: "Workflow history",     pro: true,  enterprise: true  },
  { name: "GitHub integration",   pro: true,  enterprise: true  },
  { name: "Priority support",     pro: false, enterprise: true  },
  { name: "Governance defaults",  pro: false, enterprise: true  },
];

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
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
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise">("pro");

  const hasSubscription = hasActiveSubscription(session);
  const activePlan = session?.subscription.plan;

  const selectedPlanMeta = useMemo(
    () => planCatalog.find((plan) => plan.key === selectedPlan) ?? planCatalog[0],
    [selectedPlan],
  );

  const isCurrentPlanSelected = hasSubscription && activePlan === selectedPlan;
  let activateButtonLabel = `Activate ${selectedPlanMeta.title}`;
  if (isSubmitting) {
    activateButtonLabel = "Processing...";
  } else if (isCurrentPlanSelected) {
    activateButtonLabel = "Current plan active";
  }

  async function handleActivate(plan: "pro" | "enterprise") {
    setStatusMessage(null);
    setActionError(null);
    setIsSubmitting(true);

    try {
      await activateMonthlySubscription(plan);
      await refresh();
      setStatusMessage(
        plan === "enterprise"
          ? "Enterprise monthly plan is active. Your workspace is ready."
          : "Pro monthly plan is active. Your workspace is ready.",
      );
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
        {/* ── Page header — full width, no box ──────────────────────── */}
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
            Monthly subscription plans for project creation
          </motion.h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 580, margin: 0, lineHeight: 1.6 }}>
            Use Google or GitHub login, choose your monthly plan, and unlock project creation,
            workflow generation, and history features.
          </p>

          <div className="status-pill-row" style={{ marginTop: "1.2rem" }}>
            <span className="status-pill">Currency: PHP</span>
            <span className="status-pill">
              Current status: {session?.subscription.status ?? (status === "signed-in" ? "inactive" : "guest")}
            </span>
            <span className="status-pill">Current plan: {activePlan ?? "free"}</span>
          </div>
        </div>

        {/* ── Comparison table — no outer box ───────────────────────── */}
        <div style={{ padding: "0 clamp(2rem,6vw,5rem) 2rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <p className="section-divider" style={{ marginBottom: "1.5rem" }}>plan comparison</p>

          <div className="pricing-table">
            {/* Header row — empty feature label column, then plan columns */}
            <div className="pricing-table-header pricing-table-empty" />

            <div className="pricing-table-header">
              <p className="pricing-table-plan-label">Pro Monthly</p>
              <p className="pricing-table-price">₱300</p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.25rem 0 0.75rem" }}>per month</p>
              <button
                className={`primary-button${selectedPlan === "pro" ? "" : " ghost-button"}`}
                style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem", minHeight: "2.4rem" }}
                type="button"
                onClick={() => setSelectedPlan("pro")}
              >
                {selectedPlan === "pro" ? "Selected" : "Select plan"}
              </button>
              {hasSubscription && activePlan === "pro" && (
                <span className="status-pill" style={{ marginTop: "0.5rem", display: "inline-flex" }}>Active</span>
              )}
            </div>

            <div className="pricing-table-header" style={{ borderLeft: "none" }}>
              <p className="pricing-table-plan-label">Enterprise Monthly</p>
              <p className="pricing-table-price enterprise">₱1,200</p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.25rem 0 0.75rem" }}>per month</p>
              <button
                className={`ghost-button${selectedPlan === "enterprise" ? " primary-button" : ""}`}
                style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem", minHeight: "2.4rem" }}
                type="button"
                onClick={() => setSelectedPlan("enterprise")}
              >
                {selectedPlan === "enterprise" ? "Selected" : "Select plan"}
              </button>
              {hasSubscription && activePlan === "enterprise" && (
                <span className="status-pill" style={{ marginTop: "0.5rem", display: "inline-flex" }}>Active</span>
              )}
            </div>

            {/* Feature rows */}
            {featureRows.map((row) => (
              <div key={row.name} style={{ display: "contents" }}>
                <div className="pricing-table-cell feature-name">{row.name}</div>
                <div className={`pricing-table-cell${row.pro ? " check" : ""}`}>
                  {row.pro
                    ? <CheckIcon />
                    : <span style={{ color: "var(--text-muted)" }}>—</span>
                  }
                </div>
                <div className={`pricing-table-cell${row.enterprise ? " check" : ""}`}>
                  {row.enterprise
                    ? <CheckIcon />
                    : <span style={{ color: "var(--text-muted)" }}>—</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Activate section — no box ──────────────────────────────── */}
        <div style={{ padding: "2rem clamp(2rem,6vw,5rem)", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <p className="section-divider" style={{ marginBottom: "1.5rem" }}>activate</p>
          <h2 style={{ fontSize: "clamp(1.4rem,2.5vw,2rem)", marginBottom: "0.6rem" }}>Activate your monthly plan</h2>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 1.2rem" }}>
            Selected plan: <strong>{selectedPlanMeta.title}</strong> at{" "}
            <strong>{selectedPlanMeta.amount} pesos/month</strong>.
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
                  Sign up with Google or GitHub first
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
                  disabled={isSubmitting || isCurrentPlanSelected}
                  onClick={() => void handleActivate(selectedPlan)}
                >
                  {activateButtonLabel}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isSubmitting || !hasSubscription}
                  onClick={() => void handleCancel()}
                >
                  Cancel monthly subscription
                </button>
              </>
            ) : null}

            <Link className="ghost-button" href="/workflows">
              Create Project
            </Link>
          </div>
          {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}
        </div>

        {/* ── Billing notes — no box ─────────────────────────────────── */}
        <div style={{ padding: "2rem clamp(2rem,6vw,5rem) clamp(3rem,6vw,5rem)", maxWidth: 900, margin: "0 auto", width: "100%", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>billing/notes.md</p>
          <h2 style={{ fontSize: "clamp(1.2rem,2vw,1.6rem)", marginBottom: "0.75rem" }}>Billing notes</h2>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 0.75rem", lineHeight: 1.6 }}>
            This monthly flow is environment-backed for product testing. You can switch between Pro and
            Enterprise plans and validate entitlement changes immediately in Create Project.
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
    </main>
  );
}
