"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
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
  "Connect your GitHub account",
  "Pick monthly plan",
  "Activate and open workflow studio",
  "Generate and download YAML",
];

type PlanOption = (typeof planCatalog)[number];

interface PlanOptionCardProps {
  plan: PlanOption;
  selectedPlan: "pro" | "enterprise";
  activePlan?: string;
  hasSubscription: boolean;
  onSelectPlan: (plan: "pro" | "enterprise") => void;
}

function PlanOptionCard({
  plan,
  selectedPlan,
  activePlan,
  hasSubscription,
  onSelectPlan,
}: Readonly<PlanOptionCardProps>) {
  const isActivePlan = hasSubscription && activePlan === plan.key;
  const isSelected = selectedPlan === plan.key;

  return (
    <article className={`subscription-plan-card ${isSelected ? "selected" : ""}`}>
      <p className="hero-kicker">{plan.title}</p>
      <h2>{plan.amount} pesos</h2>
      <p className="helper-text">Per month</p>
      <p>{plan.summary}</p>

      <ul className="feature-list" aria-label={`${plan.title} features`}>
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <div className="hero-actions">
        <button className="ghost-button" type="button" onClick={() => onSelectPlan(plan.key)}>
          {isSelected ? "Selected" : "Select plan"}
        </button>
        {isActivePlan ? <span className="status-pill">Active</span> : null}
      </div>
    </article>
  );
}

export default function SubscribePage() {
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
      setStatusMessage("Subscription activation failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      await cancelMonthlySubscription();
      await refresh();
      setStatusMessage("Monthly subscription canceled.");
    } catch {
      setStatusMessage("Cancel request failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/">Landing</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/workflows">Workflows</Link>
        </nav>
        <Link className="ghost-button" href="/">
          Back to landing
        </Link>
      </header>

      <section className="section-card pricing-page-card subscription-rail glass-panel">
        <motion.p
          className="hero-kicker"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          Billing
        </motion.p>
        <motion.h1
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Monthly subscription plans for workflow generation
        </motion.h1>
        <p>
          Use GitHub login, choose your monthly plan, and unlock complete setup, generation, and history features.
        </p>

        <div className="status-pill-row">
          <span className="status-pill">Currency: PHP</span>
          <span className="status-pill">
            Current status: {session?.subscription.status ?? (status === "signed-in" ? "inactive" : "guest")}
          </span>
          <span className="status-pill">Current plan: {activePlan ?? "free"}</span>
        </div>
      </section>

      <section className="section-card pricing-page-card subscription-rail glass-panel">
        <div className="subscription-plan-grid">
          {planCatalog.map((plan) => (
            <PlanOptionCard
              key={plan.key}
              plan={plan}
              selectedPlan={selectedPlan}
              activePlan={activePlan}
              hasSubscription={hasSubscription}
              onSelectPlan={setSelectedPlan}
            />
          ))}
        </div>
      </section>

      <section className="section-card pricing-page-card subscription-rail glass-panel">
        <h2>Activate your monthly plan</h2>
        <p>
          Selected plan: <strong>{selectedPlanMeta.title}</strong> at <strong>{selectedPlanMeta.amount} pesos/month</strong>.
        </p>

        <ol className="subscription-checklist">
          {activationChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>

        <div className="hero-actions">
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
            Browse workflows
          </Link>
        </div>
      </section>

      <section className="section-card pricing-page-card subscription-rail glass-panel">
        <h2>Billing notes</h2>
        <p>
          This monthly flow is environment-backed for product testing. You can switch between Pro and Enterprise plans
          and validate entitlement changes immediately in the workflow studio.
        </p>
        <p>
          If your status updates but UI still shows old data, run a session refresh by revisiting login or home.
        </p>

        {status === "loading" ? <p className="helper-text">Checking your account status...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {statusMessage ? <p className="helper-text">{statusMessage}</p> : null}
      </section>
    </main>
  );
}
